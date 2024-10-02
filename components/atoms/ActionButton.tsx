import React from "react";
import { Button } from "../ui/button";
import { MdDelete, MdEdit } from "react-icons/md";
import { FaPlus } from "react-icons/fa6";

interface CustomAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "success" | "warning" | "destructive" | "outline";
  className?: string;
}

interface BaseActionProps {
  onDelete?: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
  customActions?: CustomAction[]; // Array to pass custom actions dynamically
}

const ActionButton = ({
  onDelete,
  onEdit,
  onAdd,
  customActions = [],
}: BaseActionProps) => {
  return (
    <div className="flex flex-row gap-3">
      {onAdd && (
        <Button
          onClick={onAdd}
          variant="success"
          className="font-semibold text-sm"
        >
          <FaPlus /> Add
        </Button>
      )}
      {onEdit && (
        <Button
          onClick={onEdit}
          variant="warning"
          className="font-semibold text-sm"
        >
          <MdEdit /> Edit
        </Button>
      )}
      {onDelete && (
        <Button
          onClick={onDelete}
          variant="destructive"
          className="font-semibold text-sm"
        >
          <MdDelete />
          Delete
        </Button>
      )}
      {customActions.map((action, index) => (
        <Button
          key={index}
          onClick={action.onClick}
          variant={action.variant || "default"}
          className={`font-semibold text-sm ${action.className || ""}`}
        >
          {action.icon} {action.label}
        </Button>
      ))}
    </div>
  );
};

export default ActionButton;
