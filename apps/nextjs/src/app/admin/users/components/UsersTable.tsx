import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { Role } from "@schnau/lib/src/users/user";

import type { User } from "../user.type";
import { Actions } from "./Actions";
import { SelectCell, TextFieldCell } from "./Fields";
import { Status } from "./Status";

interface Props {
  users: User[];
  updateRow: (
    rowIndex: number,
    update: Pick<User, "id"> & Partial<User>,
  ) => void;
  updates: Map<number, Partial<User>>;
  onClickChangePassword: (user: User) => void;
}

const column = createColumnHelper<User>();

const roleMap: Record<Role, string> = {
  TEACHER: "Lehrer",
  STUDENT: "Schüler",
  ADMIN: "Administrator",
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

export const UsersTable = ({
  users,
  updateRow,
  updates,
  onClickChangePassword,
}: Props) => {
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
        cell: ({ getValue }) => (
          <div className="w-full p-2 text-center">{getValue()}</div>
        ),
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
      column.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => <Status user={row.original} />,
      }),
      column.display({
        id: "actions",
        header: "Aktionen",
        cell: ({ row }) => (
          <Actions
            user={row.original}
            onClickChangePassword={onClickChangePassword}
          />
        ),
      }),
    ],
    [handleUpdateRow, onClickChangePassword, updates],
  );

  const table = useReactTable({
    columns,
    data: users,
    autoResetPageIndex,
    getCoreRowModel: getCoreRowModel<User>(),
  });

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns:
          "min-content 1fr min-content 1fr min-content min-content min-content",
      }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <Fragment key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <th key={header.id} className={"border border-grey-100 px-2 py-4"}>
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </th>
          ))}
        </Fragment>
      ))}
      {table.getRowModel().rows.map((row) => (
        <Fragment key={row.id}>
          {row.getVisibleCells().map((cell) => (
            <td
              key={cell.id}
              className="flex items-center border border-grey-100"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </Fragment>
      ))}
    </div>
  );
};
