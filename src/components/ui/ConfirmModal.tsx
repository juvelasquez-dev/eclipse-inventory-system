import Button from "./Button";
import Modal from "./Modal";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
    >
      <div className="space-y-6">

        <p className="text-sm text-slate-600">
          {message}
        </p>

        <div className="flex justify-end gap-3">

          <Button
            type="button"
            onClick={onCancel}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>

        </div>

      </div>
    </Modal>
  );
}