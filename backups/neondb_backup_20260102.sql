--
-- PostgreSQL database dump
--

\restrict Ny2TrjCbh5GIFrsBrCmbJOVC2Rjt55DaZUyeflLe7QdNxnWNDOpnph4DkauaNIP

-- Dumped from database version 16.11 (74c6bb6)
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired'
);


--
-- Name: member_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.member_role AS ENUM (
    'admin',
    'member'
);


--
-- Name: session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_status AS ENUM (
    'active',
    'completed',
    'cancelled'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'todo',
    'inprogress',
    'inreview',
    'done',
    'cancelled'
);


--
-- Name: electric_sync_table(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.electric_sync_table(p_schema text, p_table text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    qualified text := format('%I.%I', p_schema, p_table);
BEGIN
    EXECUTE format('ALTER TABLE %s REPLICA IDENTITY FULL', qualified);
    EXECUTE format('GRANT SELECT ON TABLE %s TO electric_sync', qualified);
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE %s', 'electric_publication_default', qualified);
END;
$$;


--
-- Name: set_last_used_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_last_used_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.last_used_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_secret_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    refresh_token_id uuid,
    refresh_token_issued_at timestamp with time zone
);


--
-- Name: github_app_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_app_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    github_installation_id bigint NOT NULL,
    github_account_login text NOT NULL,
    github_account_type text NOT NULL,
    repository_selection text NOT NULL,
    installed_by_user_id uuid,
    suspended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_app_pending_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_app_pending_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    state_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_app_repositories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_app_repositories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installation_id uuid NOT NULL,
    github_repo_id bigint NOT NULL,
    repo_full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    review_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: oauth_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    email text,
    username text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: oauth_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    state text NOT NULL,
    return_to text NOT NULL,
    app_challenge text NOT NULL,
    app_code_hash text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_code text,
    expires_at timestamp with time zone NOT NULL,
    authorized_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    user_id uuid,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    encrypted_provider_tokens text
);


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    invited_by_user_id uuid,
    email text NOT NULL,
    role public.member_role DEFAULT 'member'::public.member_role NOT NULL,
    status public.invitation_status DEFAULT 'pending'::public.invitation_status NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_member_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_member_metadata (
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.member_role DEFAULT 'member'::public.member_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_personal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gh_pr_url text NOT NULL,
    claude_code_session_id text,
    ip_address inet,
    review_cache jsonb,
    last_viewed_at timestamp with time zone,
    r2_path text NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    pr_title text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    github_installation_id bigint,
    pr_owner text,
    pr_repo text,
    pr_number integer
);


--
-- Name: revoked_refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revoked_refresh_tokens (
    token_id uuid NOT NULL,
    user_id uuid NOT NULL,
    revoked_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_reason text NOT NULL
);


--
-- Name: shared_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    project_id uuid NOT NULL,
    creator_user_id uuid,
    assignee_user_id uuid,
    deleted_by_user_id uuid,
    title text NOT NULL,
    description text,
    status public.task_status DEFAULT 'todo'::public.task_status NOT NULL,
    deleted_at timestamp with time zone,
    shared_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.shared_tasks REPLICA IDENTITY FULL;


--
-- Name: task_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    executor text,
    name text,
    status public.session_status DEFAULT 'active'::public.session_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    theme text DEFAULT 'SYSTEM'::text NOT NULL,
    language text DEFAULT 'EN'::text NOT NULL,
    notifications jsonb DEFAULT '{"push_enabled": false, "sound_enabled": true}'::jsonb NOT NULL,
    analytics_enabled boolean DEFAULT false NOT NULL,
    pr_auto_description_enabled boolean DEFAULT false NOT NULL,
    pr_auto_description_prompt text,
    git_branch_prefix text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_customer_id text,
    CONSTRAINT user_settings_theme_check CHECK ((theme = ANY (ARRAY['LIGHT'::text, 'DARK'::text, 'SYSTEM'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    username text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_sessions (id, user_id, session_secret_hash, created_at, last_used_at, revoked_at, refresh_token_id, refresh_token_issued_at) FROM stdin;
\.


--
-- Data for Name: github_app_installations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.github_app_installations (id, organization_id, github_installation_id, github_account_login, github_account_type, repository_selection, installed_by_user_id, suspended_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: github_app_pending_installations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.github_app_pending_installations (id, organization_id, user_id, state_token, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: github_app_repositories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.github_app_repositories (id, installation_id, github_repo_id, repo_full_name, created_at, review_enabled) FROM stdin;
\.


--
-- Data for Name: oauth_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.oauth_accounts (id, user_id, provider, provider_user_id, email, username, display_name, avatar_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: oauth_handoffs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.oauth_handoffs (id, provider, state, return_to, app_challenge, app_code_hash, status, error_code, expires_at, authorized_at, redeemed_at, user_id, session_id, created_at, updated_at, encrypted_provider_tokens) FROM stdin;
\.


--
-- Data for Name: organization_invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_invitations (id, organization_id, invited_by_user_id, email, role, status, token, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_member_metadata; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_member_metadata (organization_id, user_id, role, joined_at, last_seen_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, slug, is_personal, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, organization_id, name, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, gh_pr_url, claude_code_session_id, ip_address, review_cache, last_viewed_at, r2_path, deleted_at, created_at, email, pr_title, status, github_installation_id, pr_owner, pr_repo, pr_number) FROM stdin;
\.


--
-- Data for Name: revoked_refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.revoked_refresh_tokens (token_id, user_id, revoked_at, revoked_reason) FROM stdin;
\.


--
-- Data for Name: shared_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shared_tasks (id, organization_id, project_id, creator_user_id, assignee_user_id, deleted_by_user_id, title, description, status, deleted_at, shared_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: task_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_sessions (id, task_id, executor, name, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_settings (id, user_id, theme, language, notifications, analytics_enabled, pr_auto_description_enabled, pr_auto_description_prompt, git_branch_prefix, created_at, updated_at, stripe_customer_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, username, created_at, updated_at) FROM stdin;
\.


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: github_app_installations github_app_installations_github_installation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_installations
    ADD CONSTRAINT github_app_installations_github_installation_id_key UNIQUE (github_installation_id);


--
-- Name: github_app_installations github_app_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_installations
    ADD CONSTRAINT github_app_installations_pkey PRIMARY KEY (id);


--
-- Name: github_app_pending_installations github_app_pending_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_pending_installations
    ADD CONSTRAINT github_app_pending_installations_pkey PRIMARY KEY (id);


--
-- Name: github_app_pending_installations github_app_pending_installations_state_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_pending_installations
    ADD CONSTRAINT github_app_pending_installations_state_token_key UNIQUE (state_token);


--
-- Name: github_app_repositories github_app_repositories_installation_id_github_repo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_repositories
    ADD CONSTRAINT github_app_repositories_installation_id_github_repo_id_key UNIQUE (installation_id, github_repo_id);


--
-- Name: github_app_repositories github_app_repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_repositories
    ADD CONSTRAINT github_app_repositories_pkey PRIMARY KEY (id);


--
-- Name: oauth_accounts oauth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_pkey PRIMARY KEY (id);


--
-- Name: oauth_accounts oauth_accounts_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: oauth_handoffs oauth_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_handoffs
    ADD CONSTRAINT oauth_handoffs_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_key UNIQUE (token);


--
-- Name: organization_member_metadata organization_member_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_member_metadata
    ADD CONSTRAINT organization_member_metadata_pkey PRIMARY KEY (organization_id, user_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: revoked_refresh_tokens revoked_refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_refresh_tokens
    ADD CONSTRAINT revoked_refresh_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: shared_tasks shared_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_pkey PRIMARY KEY (id);


--
-- Name: task_sessions task_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_auth_sessions_refresh_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_sessions_refresh_id ON public.auth_sessions USING btree (refresh_token_id);


--
-- Name: idx_auth_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_sessions_user ON public.auth_sessions USING btree (user_id);


--
-- Name: idx_github_app_installations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_github_app_installations_org ON public.github_app_installations USING btree (organization_id);


--
-- Name: idx_github_app_repos_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_github_app_repos_installation ON public.github_app_repositories USING btree (installation_id);


--
-- Name: idx_github_app_repos_review_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_github_app_repos_review_enabled ON public.github_app_repositories USING btree (installation_id, review_enabled) WHERE (review_enabled = true);


--
-- Name: idx_member_metadata_org_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_metadata_org_role ON public.organization_member_metadata USING btree (organization_id, role);


--
-- Name: idx_member_metadata_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_metadata_user ON public.organization_member_metadata USING btree (user_id);


--
-- Name: idx_oauth_accounts_provider_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_accounts_provider_user ON public.oauth_accounts USING btree (provider, provider_user_id);


--
-- Name: idx_oauth_accounts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_accounts_user ON public.oauth_accounts USING btree (user_id);


--
-- Name: idx_oauth_handoffs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_handoffs_status ON public.oauth_handoffs USING btree (status);


--
-- Name: idx_oauth_handoffs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_handoffs_user ON public.oauth_handoffs USING btree (user_id);


--
-- Name: idx_org_invites_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invites_org ON public.organization_invitations USING btree (organization_id);


--
-- Name: idx_org_invites_status_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invites_status_expires ON public.organization_invitations USING btree (status, expires_at);


--
-- Name: idx_pending_installations_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_installations_expires ON public.github_app_pending_installations USING btree (expires_at);


--
-- Name: idx_pending_installations_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_installations_state ON public.github_app_pending_installations USING btree (state_token);


--
-- Name: idx_projects_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_org_name ON public.projects USING btree (organization_id, name);


--
-- Name: idx_reviews_ip_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_ip_created ON public.reviews USING btree (ip_address, created_at);


--
-- Name: idx_reviews_webhook; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_webhook ON public.reviews USING btree (github_installation_id) WHERE (github_installation_id IS NOT NULL);


--
-- Name: idx_revoked_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revoked_tokens_user ON public.revoked_refresh_tokens USING btree (user_id);


--
-- Name: idx_shared_tasks_org_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_tasks_org_deleted_at ON public.shared_tasks USING btree (organization_id, deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_task_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_sessions_status ON public.task_sessions USING btree (status);


--
-- Name: idx_task_sessions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_sessions_task_id ON public.task_sessions USING btree (task_id);


--
-- Name: idx_task_sessions_task_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_sessions_task_status ON public.task_sessions USING btree (task_id, status);


--
-- Name: idx_tasks_org_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_org_assignee ON public.shared_tasks USING btree (organization_id, assignee_user_id);


--
-- Name: idx_tasks_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_org_status ON public.shared_tasks USING btree (organization_id, status);


--
-- Name: idx_tasks_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project ON public.shared_tasks USING btree (project_id);


--
-- Name: idx_user_settings_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_stripe_customer_id ON public.user_settings USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: idx_user_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);


--
-- Name: uniq_pending_invite_per_email_per_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_pending_invite_per_email_per_org ON public.organization_invitations USING btree (organization_id, lower(email)) WHERE (status = 'pending'::public.invitation_status);


--
-- Name: task_sessions set_task_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_task_sessions_updated_at BEFORE UPDATE ON public.task_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_settings set_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: auth_sessions trg_auth_sessions_last_used_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auth_sessions_last_used_at BEFORE UPDATE ON public.auth_sessions FOR EACH ROW EXECUTE FUNCTION public.set_last_used_at();


--
-- Name: oauth_accounts trg_oauth_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_oauth_accounts_updated_at BEFORE UPDATE ON public.oauth_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: oauth_handoffs trg_oauth_handoffs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_oauth_handoffs_updated_at BEFORE UPDATE ON public.oauth_handoffs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organization_invitations trg_org_invites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_invites_updated_at BEFORE UPDATE ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations trg_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shared_tasks trg_shared_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shared_tasks_updated_at BEFORE UPDATE ON public.shared_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: auth_sessions auth_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: github_app_installations github_app_installations_installed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_installations
    ADD CONSTRAINT github_app_installations_installed_by_user_id_fkey FOREIGN KEY (installed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: github_app_installations github_app_installations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_installations
    ADD CONSTRAINT github_app_installations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: github_app_pending_installations github_app_pending_installations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_pending_installations
    ADD CONSTRAINT github_app_pending_installations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: github_app_pending_installations github_app_pending_installations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_pending_installations
    ADD CONSTRAINT github_app_pending_installations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: github_app_repositories github_app_repositories_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_app_repositories
    ADD CONSTRAINT github_app_repositories_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.github_app_installations(id) ON DELETE CASCADE;


--
-- Name: oauth_accounts oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_handoffs oauth_handoffs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_handoffs
    ADD CONSTRAINT oauth_handoffs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.auth_sessions(id) ON DELETE SET NULL;


--
-- Name: oauth_handoffs oauth_handoffs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_handoffs
    ADD CONSTRAINT oauth_handoffs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: organization_invitations organization_invitations_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_member_metadata organization_member_metadata_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_member_metadata
    ADD CONSTRAINT organization_member_metadata_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_member_metadata organization_member_metadata_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_member_metadata
    ADD CONSTRAINT organization_member_metadata_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: revoked_refresh_tokens revoked_refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_refresh_tokens
    ADD CONSTRAINT revoked_refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shared_tasks shared_tasks_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shared_tasks shared_tasks_creator_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_creator_user_id_fkey FOREIGN KEY (creator_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shared_tasks shared_tasks_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shared_tasks shared_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: shared_tasks shared_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_sessions task_sessions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sessions
    ADD CONSTRAINT task_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.shared_tasks(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: electric_publication_default; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION electric_publication_default WITH (publish = 'insert, update, delete, truncate');


--
-- Name: electric_publication_default shared_tasks; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION electric_publication_default ADD TABLE ONLY public.shared_tasks;


--
-- PostgreSQL database dump complete
--

\unrestrict Ny2TrjCbh5GIFrsBrCmbJOVC2Rjt55DaZUyeflLe7QdNxnWNDOpnph4DkauaNIP

