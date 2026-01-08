import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useState } from "react";
import { EditorType, type Project } from "shared/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOpenProjectInEditor } from "@/hooks/useOpenProjectInEditor";
import { defineModal } from "@/lib/modals";

export interface ProjectEditorSelectionDialogProps {
  selectedProject: Project | null;
}

const ProjectEditorSelectionDialogImpl =
  NiceModal.create<ProjectEditorSelectionDialogProps>(({ selectedProject }) => {
    const modal = useModal();
    const handleOpenInEditor = useOpenProjectInEditor(selectedProject, () =>
      modal.hide()
    );
    const [selectedEditor, setSelectedEditor] = useState<EditorType>(
      EditorType.VS_CODE
    );

    const handleConfirm = () => {
      handleOpenInEditor(selectedEditor);
      modal.resolve(selectedEditor);
      modal.hide();
    };

    const handleCancel = () => {
      modal.resolve(null);
      modal.hide();
    };

    return (
      <Dialog
        onOpenChange={(open) => !open && handleCancel()}
        open={modal.visible}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Choose Editor</DialogTitle>
            <DialogDescription>
              The default editor failed to open. Please select an alternative
              editor to open the project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="font-medium text-sm">Editor</label>
              <Select
                onValueChange={(value) =>
                  setSelectedEditor(value as EditorType)
                }
                value={selectedEditor}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(EditorType).map((editor) => (
                    <SelectItem key={editor} value={editor}>
                      {editor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancel} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Open Editor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  });

export const ProjectEditorSelectionDialog = defineModal<
  ProjectEditorSelectionDialogProps,
  EditorType | null
>(ProjectEditorSelectionDialogImpl);
