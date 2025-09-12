import * as React from "react";
import { cn } from "../../../lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium text-gray-600 dark:text-gray-300", className)}
      {...props}
    />
  );
}

