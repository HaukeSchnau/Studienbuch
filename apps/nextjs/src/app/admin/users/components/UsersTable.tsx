import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";

import type { Role, User } from "@schnau/lib/src/users/user";

interface Props {
  users: User[];
  updateRow: (
    rowIndex: number,
    update: Pick<User, "id"> & Partial<User>,
  ) => void;
  updates: Map<number, Partial<User>>;
}

const column = createColumnHelper<User>();

const roleMap: Record<Role, string> = {
  TEACHER: "Lehrer",
  STUDENT: "Schüler",
  ADMIN: "Administrator",
};

interface TextFieldCellProps {
  value: string;
  updateData: (value: string) => void;
  isDirty: boolean;
}

const TextFieldCell = ({
  value: initialValue,
  updateData,
  isDirty,
}: TextFieldCellProps) => {
  const [value, setValue] = useState(initialValue);

  const onBlur = () => {
    if (value === initialValue) return;
    updateData(value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      type="text"
      value={value}
      onBlur={onBlur}
      onChange={(e) => setValue(e.target.value)}
      className={clsx("w-full p-2", isDirty && "bg-yellow text-white")}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
};

interface SelectCellProps<TValues extends string> {
  value: TValues;
  values: TValues[];
  updateData: (value: TValues) => void;
  getLabel?: (value: TValues) => string;
  isDirty: boolean;
}

const SelectCell = <TValues extends string>({
  value: initialValue,
  values,
  updateData,
  getLabel = (value) => value,
  isDirty,
}: SelectCellProps<TValues>) => {
  const [value, setValue] = useState(initialValue);

  const onBlur = () => {
    if (value === initialValue) return;
    updateData(value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <select
      value={value}
      onBlur={onBlur}
      onChange={(e) => setValue(e.target.value as TValues)}
      className={clsx("w-full p-2", isDirty && "bg-yellow text-white")}
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {getLabel(value)}
        </option>
      ))}
    </select>
  );
};

function useSkipper() {
  const shouldSkipRef = useRef(true);
  const shouldSkip = shouldSkipRef.current;

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  useEffect(() => {
    shouldSkipRef.current = true;
  });

  return [shouldSkip, skip] as const;
}

export const UsersTable = ({ users, updateRow, updates }: Props) => {
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const handleUpdateRow = useCallback(
    (rowIndex: number, update: Pick<User, "id"> & Partial<User>) => {
      updateRow(rowIndex, update);
      skipAutoResetPageIndex();
    },
    [updateRow, skipAutoResetPageIndex],
  );

  const columns = useMemo(
    () => [
      column.accessor("title", {
        header: "Anrede",
        cell: ({ getValue, row }) => (
          <TextFieldCell
            value={getValue() ?? ""}
            updateData={(value) =>
              handleUpdateRow(row.index, {
                id: row.original.id,
                title: value ? value : null,
              })
            }
            isDirty={updates.get(row.original.id)?.title !== undefined}
          />
        ),
      }),
      column.accessor("name", {
        header: "Name",
        cell: ({ getValue, row }) => (
          <TextFieldCell
            value={getValue()}
            updateData={(value) =>
              handleUpdateRow(row.index, { id: row.original.id, name: value })
            }
            isDirty={updates.get(row.original.id)?.name !== undefined}
          />
        ),
      }),
      column.accessor("abbrv", {
        header: "Kürzel",
      }),
      column.accessor("email", {
        header: "Email",
        cell: ({ getValue, row }) => (
          <TextFieldCell
            value={getValue() ?? ""}
            updateData={(value) =>
              handleUpdateRow(row.index, {
                id: row.original.id,
                email: value ? value : null,
              })
            }
            isDirty={updates.get(row.original.id)?.email !== undefined}
          />
        ),
      }),
      column.accessor("role", {
        id: "role",
        header: "Rolle",
        cell: ({ getValue, row }) => (
          <SelectCell
            value={getValue()}
            values={Object.keys(roleMap) as Role[]}
            updateData={(value) =>
              handleUpdateRow(row.index, { id: row.original.id, role: value })
            }
            getLabel={(value) => roleMap[value]}
            isDirty={updates.get(row.original.id)?.role !== undefined}
          />
        ),
      }),
    ],
    [handleUpdateRow, updates],
  );

  const table = useReactTable({
    columns,
    data: users,
    autoResetPageIndex,
    getCoreRowModel: getCoreRowModel<User>(),
  });

  return (
    <>
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border border-grey-100 py-4 ">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border border-grey-100">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
