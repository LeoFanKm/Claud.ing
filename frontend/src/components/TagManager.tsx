import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Tag } from "shared/types";
import { TagEditDialog } from "@/components/dialogs/tasks/TagEditDialog";
import { Button } from "@/components/ui/button";
import { tagsApi } from "@/lib/api";

export function TagManager() {
  const { t } = useTranslation("settings");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tagsApi.list();
      setTags(data);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleOpenDialog = useCallback(
    async (tag?: Tag) => {
      try {
        const result = await TagEditDialog.show({
          tag: tag || null,
        });

        if (result === "saved") {
          await fetchTags();
        }
      } catch (error) {
        // User cancelled - do nothing
      }
    },
    [fetchTags]
  );

  const handleDelete = useCallback(
    async (tag: Tag) => {
      if (
        !confirm(
          t("settings.general.tags.manager.deleteConfirm", {
            tagName: tag.tag_name,
          })
        )
      ) {
        return;
      }

      try {
        await tagsApi.delete(tag.id);
        await fetchTags();
      } catch (err) {
        console.error("Failed to delete tag:", err);
      }
    },
    [fetchTags, t]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {t("settings.general.tags.manager.title")}
        </h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.general.tags.manager.addTag")}
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {t("settings.general.tags.manager.noTags")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 border-b bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-medium text-sm">
                    {t("settings.general.tags.manager.table.tagName")}
                  </th>
                  <th className="p-2 text-left font-medium text-sm">
                    {t("settings.general.tags.manager.table.content")}
                  </th>
                  <th className="p-2 text-right font-medium text-sm">
                    {t("settings.general.tags.manager.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr
                    className="border-b transition-colors hover:bg-muted/30"
                    key={tag.id}
                  >
                    <td className="p-2 font-medium text-sm">@{tag.tag_name}</td>
                    <td className="p-2 text-sm">
                      <div
                        className="max-w-[400px] truncate"
                        title={tag.content || ""}
                      >
                        {tag.content || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          className="h-7 w-7"
                          onClick={() => handleOpenDialog(tag)}
                          size="icon"
                          title={t(
                            "settings.general.tags.manager.actions.editTag"
                          )}
                          variant="ghost"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          className="h-7 w-7"
                          onClick={() => handleDelete(tag)}
                          size="icon"
                          title={t(
                            "settings.general.tags.manager.actions.deleteTag"
                          )}
                          variant="ghost"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
