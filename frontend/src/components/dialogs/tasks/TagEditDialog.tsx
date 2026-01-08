import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreateTag, Tag, UpdateTag } from "shared/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tagsApi } from "@/lib/api";
import { defineModal, getErrorMessage } from "@/lib/modals";

export interface TagEditDialogProps {
  tag?: Tag | null; // null for create mode
}

export type TagEditResult = "saved" | "canceled";

const TagEditDialogImpl = NiceModal.create<TagEditDialogProps>(({ tag }) => {
  const modal = useModal();
  const { t } = useTranslation("settings");
  const [formData, setFormData] = useState({
    tag_name: "",
    content: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagNameError, setTagNameError] = useState<string | null>(null);

  const isEditMode = Boolean(tag);

  useEffect(() => {
    if (tag) {
      setFormData({
        tag_name: tag.tag_name,
        content: tag.content,
      });
    } else {
      setFormData({
        tag_name: "",
        content: "",
      });
    }
    setError(null);
    setTagNameError(null);
  }, [tag]);

  const handleSave = async () => {
    if (!formData.tag_name.trim()) {
      setError(t("settings.general.tags.dialog.errors.nameRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditMode && tag) {
        const updateData: UpdateTag = {
          tag_name: formData.tag_name,
          content: formData.content || null, // null means "don't update"
        };
        await tagsApi.update(tag.id, updateData);
      } else {
        const createData: CreateTag = {
          tag_name: formData.tag_name,
          content: formData.content,
        };
        await tagsApi.create(createData);
      }

      modal.resolve("saved" as TagEditResult);
      modal.hide();
    } catch (err: unknown) {
      setError(
        getErrorMessage(err) ||
          t("settings.general.tags.dialog.errors.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    modal.resolve("canceled" as TagEditResult);
    modal.hide();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form data when dialog closes
      setFormData({
        tag_name: "",
        content: "",
      });
      setError(null);
      handleCancel();
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t("settings.general.tags.dialog.editTitle")
              : t("settings.general.tags.dialog.createTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="tag-name">
              {t("settings.general.tags.dialog.tagName.label")}{" "}
              <span className="text-destructive">
                {t("settings.general.tags.dialog.tagName.required")}
              </span>
            </Label>
            <p className="mb-1.5 text-muted-foreground text-xs">
              {t("settings.general.tags.dialog.tagName.hint", {
                tagName: formData.tag_name || "tag_name",
              })}
            </p>
            <Input
              aria-invalid={!!tagNameError}
              autoFocus
              className={tagNameError ? "border-destructive" : undefined}
              disabled={saving}
              id="tag-name"
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, tag_name: value });

                // Validate in real-time for spaces
                if (value.includes(" ")) {
                  setTagNameError(
                    t("settings.general.tags.dialog.tagName.error")
                  );
                } else {
                  setTagNameError(null);
                }
              }}
              placeholder={t(
                "settings.general.tags.dialog.tagName.placeholder"
              )}
              value={formData.tag_name}
            />
            {tagNameError && (
              <p className="text-destructive text-sm">{tagNameError}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tag-content">
              {t("settings.general.tags.dialog.content.label")}{" "}
              <span className="text-destructive">
                {t("settings.general.tags.dialog.content.required")}
              </span>
            </Label>
            <p className="mb-1.5 text-muted-foreground text-xs">
              {t("settings.general.tags.dialog.content.hint", {
                tagName: formData.tag_name || "tag_name",
              })}
            </p>
            <Textarea
              disabled={saving}
              id="tag-content"
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, content: value });
              }}
              placeholder={t(
                "settings.general.tags.dialog.content.placeholder"
              )}
              rows={6}
              value={formData.content}
            />
          </div>
          {error && <Alert variant="destructive">{error}</Alert>}
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={handleCancel} variant="outline">
            {t("settings.general.tags.dialog.buttons.cancel")}
          </Button>
          <Button
            disabled={saving || !!tagNameError || !formData.content.trim()}
            onClick={handleSave}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode
              ? t("settings.general.tags.dialog.buttons.update")
              : t("settings.general.tags.dialog.buttons.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const TagEditDialog = defineModal<TagEditDialogProps, TagEditResult>(
  TagEditDialogImpl
);
