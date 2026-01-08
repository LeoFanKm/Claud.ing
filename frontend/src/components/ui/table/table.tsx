import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table className={cn("w-full text-sm", className)} ref={ref} {...props} />
));
Table.displayName = "Table";

const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    className={cn("text-muted-foreground uppercase", className)}
    ref={ref}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody className={className} ref={ref} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    clickable?: boolean;
  }
>(({ className, clickable, ...props }, ref) => (
  <tr
    className={cn(
      "border-t",
      clickable && "cursor-pointer hover:bg-muted",
      className
    )}
    ref={ref}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th className={cn("text-left", className)} ref={ref} {...props} />
));
TableHeaderCell.displayName = "TableHeaderCell";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td className={cn("py-2", className)} ref={ref} {...props} />
));
TableCell.displayName = "TableCell";

const TableEmpty = ({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) => (
  <TableRow>
    <TableCell className="text-muted-foreground" colSpan={colSpan}>
      {children}
    </TableCell>
  </TableRow>
);

const TableLoading = ({ colSpan }: { colSpan: number }) => (
  <TableRow>
    <TableCell colSpan={colSpan}>
      <div className="h-5 w-full animate-pulse rounded bg-muted/30" />
    </TableCell>
  </TableRow>
);

export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmpty,
  TableLoading,
};
