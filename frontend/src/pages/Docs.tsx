import {
  Book,
  Cloud,
  ExternalLink,
  Github,
  Layout,
  Rocket,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Docs() {
  const features = [
    {
      icon: Layout,
      title: "Kanban Board",
      description:
        "Visual task management with drag-and-drop kanban board. Organize tasks by status and track progress at a glance.",
    },
    {
      icon: Terminal,
      title: "AI Agent Integration",
      description:
        "Seamlessly integrates with Claude Code, Cursor, and other AI coding assistants to manage development tasks.",
    },
    {
      icon: Cloud,
      title: "Cloud Sync",
      description:
        "Sync your projects and tasks across devices. Access your work from anywhere with real-time synchronization.",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description:
        "Share projects with team members. Real-time collaboration with live presence indicators.",
    },
  ];

  const quickStartSteps = [
    {
      step: 1,
      title: "Create a Project",
      description:
        "Start by creating a new project or connecting an existing Git repository.",
    },
    {
      step: 2,
      title: "Add Tasks",
      description:
        "Create tasks for your project. Describe what needs to be done and assign priorities.",
    },
    {
      step: 3,
      title: "Run with AI",
      description:
        "Let AI agents work on your tasks. Track progress in real-time as they code.",
    },
    {
      step: 4,
      title: "Review & Merge",
      description:
        "Review the generated code, provide feedback, and merge when ready.",
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Book className="h-10 w-10" />
            </div>
          </div>
          <h1 className="mb-4 font-bold text-4xl">Documentation</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Vibe Kanban is a visual task management platform designed for
            AI-assisted development. Manage your coding projects with
            intelligent automation and real-time collaboration.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <h2 className="font-semibold text-2xl">Quick Start</h2>
          </div>
          <div className="grid gap-4">
            {quickStartSteps.map((item) => (
              <Card className="border border-border" key={item.step}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="mb-1 font-medium">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="font-semibold text-2xl">Features</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <Card className="border border-border" key={feature.title}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Resources */}
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <Github className="h-6 w-6 text-primary" />
            <h2 className="font-semibold text-2xl">Resources</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a
                className="inline-flex items-center gap-2"
                href="https://github.com/anthropics/claude-code"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github className="h-4 w-4" />
                Claude Code
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                className="inline-flex items-center gap-2"
                href="https://docs.anthropic.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Book className="h-4 w-4" />
                Anthropic Docs
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </section>

        {/* Help */}
        <section>
          <Card className="border border-border bg-muted/30">
            <CardContent className="p-6 text-center">
              <h3 className="mb-2 font-semibold">Need Help?</h3>
              <p className="mb-4 text-muted-foreground text-sm">
                Have questions or need support? Check out our resources or reach
                out to the community.
              </p>
              <Button asChild variant="default">
                <a
                  className="inline-flex items-center gap-2"
                  href="https://github.com/anthropics/claude-code/issues"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Report an Issue
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
