import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { Person } from "../user.type";
import { Actions } from "./Actions";
import { SelectCell, TextFieldCell } from "./Fields";

interface Props {
  users: Person[];
  updateRow: (
    rowIndex: number,
    update: Pick<Person, "id"> & Partial<Person>,
  ) => void;
  updates: Map<string, Partial<Person>>;
  onClickDelete: (user: Person) => void;
}

const column = createColumnHelper<Person>();

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

export const PersonsTable = ({
  users,
  updateRow,
  updates,
  onClickDelete,
}: Props) => {
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const handleUpdateRow = useCallback(
    (rowIndex: number, update: Pick<Person, "id"> & Partial<Person>) => {
      updateRow(rowIndex, update);
      skipAutoResetPageIndex();
    },
    [updateRow, skipAutoResetPageIndex],
  );

  const columns = useMemo(
    () => [
      column.accessor("salutation", {
        header: "Anrede",
        cell: ({ getValue, row }) => (
          <SelectCell
            value={getValue()}
            getLabel={(value) => (value ? value : "Keine")}
            values={["Herr", "Frau"]}
            updateData={(value) =>
              handleUpdateRow(row.index, {
                id: row.original.id,
                salutation: value ? value : null,
              })
            }
            isDirty={updates.get(row.original.id)?.salutation !== undefined}
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
      column.display({
        id: "actions",
        header: "Aktionen",
        cell: ({ row }) => (
          <Actions user={row.original} onClickDelete={onClickDelete} />
        ),
      }),
    ],
    [handleUpdateRow, onClickDelete, updates],
  );

  const table = useReactTable({
    columns,
    data: users,
    autoResetPageIndex,
    getCoreRowModel: getCoreRowModel<Person>(),
  });

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: "min-content 1fr 1fr 1fr min-content",
        gap: "1px",
      }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <Fragment key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="px-2 py-4 outline outline-1 outline-grey-100"
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </div>
          ))}
        </Fragment>
      ))}
      {table.getRowModel().rows.map((row) => (
        <Fragment key={row.id}>
          {row.getVisibleCells().map((cell) => (
            <div
              key={cell.id}
              className="flex items-center outline outline-1 outline-grey-100"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
};
