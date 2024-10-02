import React, { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact, CustomCellRendererProps } from "ag-grid-react";
import {
  ColDef,
  IGetRowsParams,
  GridReadyEvent,
  GridOptions,
  ValueGetterParams,
  RowClickedEvent,
  RowClassParams,
  GridApi,
  ICellRendererParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "@radix-ui/react-icons";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Label } from "./ui/label";
import ActionButton from "./atoms/ActionButton";

interface Pengiriman {
  id: number;
  namaPengirim: string;
  alamatPengirim: string;
  nohpPengirim: string;
  namaPenerima: string;
  alamatPenerima: string;
  nohpPenerima: string;
  totalHarga: number;
  tanggalKeberangkatan: string;
  barang: Barang[];
}

interface FetchResponse {
  totalData: number;
  totalPages: number;
  currentPage: number;
  data: Pengiriman[];
}
interface Barang {
  id?: string;
  barangId: string;
  jumlahBarang: number;
  harga: number;
}

interface IPengirimanForm {
  namaPengirim: string;
  alamatPengirim: string;
  nohpPengirim: string;
  namaPenerima: string;
  alamatPenerima: string;
  nohpPenerima: string;
  barang: Barang[];
  totalHarga: number; // Added totalHarga field
  tanggalKeberangkatan: string; // Added tanggalKeberangkatan field
}
const PengirimanTable: React.FC = () => {
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const [selectedRow, setSelectedRow] = useState<Pengiriman | null>(null);
  const [newPengirimanId, setNewPengirimanId] = useState<number | null>(null);
  const gridRef = useRef<AgGridReact | null>(null);
  const relativeRowIndexRef = useRef<number>(0); // Ref untuk simpan relativeRowIndex
  const [data, setData] = useState<FetchResponse | null>(null);
  const gridApiRef = useRef<GridApi<Pengiriman> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [popOver, setPopOver] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [deleteMode, setDeleteMode] = useState<boolean>(false);
  const limit = 500;
  const [date, setDate] = useState<Date | undefined>();
  const queryClient = useQueryClient();
  // const router = useRouter();
  const { register, control, handleSubmit, reset, setValue } =
    useForm<IPengirimanForm>({
      defaultValues: {
        namaPengirim: "",
        alamatPengirim: "",
        nohpPengirim: "",
        namaPenerima: "",
        alamatPenerima: "",
        nohpPenerima: "",
        barang: [{ barangId: "", jumlahBarang: 1, harga: 0 }],
        totalHarga: 0,
        tanggalKeberangkatan: "",
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "barang",
  });

  const barang = useWatch({ control, name: "barang" });
  const fetchDetailBarang = async () => {
    const res = await fetch("/api/detail-barang"); // Ensure the path matches your API route
    if (!res.ok) throw new Error("Failed to fetch detail barang");
    return res.json();
  };
  // Fetch detail barang
  const { data: detailBarangOptions = [], isLoading: isLoadingBarang } =
    useQuery("detailBarang", fetchDetailBarang);

  const calculateTotalHarga = () => {
    const total = barang.reduce(
      (sum, item) => sum + item.jumlahBarang * item.harga,
      0
    );
    setValue("totalHarga", total);
  };

  // Fungsi POST untuk mengirim data
  const submitPengiriman = async (data: IPengirimanForm) => {
    const res = await fetch("/api/kirim-barang", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error("Failed to submit");
    }

    return res.json();
  };

  const updatePengiriman = async (id: number, data: IPengirimanForm) => {
    const res = await fetch(`/api/kirim-barang/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update data");
    return res.json();
  };

  const mutation = useMutation(submitPengiriman, {
    onSuccess: (data) => {
      const newPengirimanId = data.data.pengirimanId;

      localStorage.setItem("newPengirimanId", String(newPengirimanId));
      alert(data.message);

      setPopOver(false);
      reset();
      window.location.reload();
    },
    onError: () => {
      alert("Error dalam menyimpan data.");
    },
  });
  const mutationUpdate = useMutation(
    async (updatedData: IPengirimanForm) => {
      if (selectedRow && selectedRow.id) {
        return updatePengiriman(selectedRow.id, updatedData);
      }
    },
    {
      onSuccess: () => {
        alert("Data berhasil diperbarui.");
        setPopOver(false);
        reset();
        localStorage.setItem("newPengirimanId", String(selectedRow?.id)); // Simpan di localStorage
        setEditMode(false); // Kembali ke mode tambah setelah update
        queryClient.invalidateQueries("pengiriman");
        window.location.reload();
      },
      onError: () => {
        alert("Gagal memperbarui data.");
      },
    }
  );
  const onSubmit = (data: IPengirimanForm) => {
    if (editMode && selectedRow !== null) {
      mutationUpdate.mutate(data);
    } else {
      mutation.mutate(data);
    }
  };

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      const api = params.api; // Ambil api dari event onGridReady
      gridApiRef.current = params.api; // Simpan api grid

      const dataSource = {
        getRows: async (params: IGetRowsParams) => {
          const currentPageNumber = Math.floor(params.startRow / limit) + 1;

          const filterModel = params.filterModel;
          const selectedDate = filterModel?.tanggalKeberangkatan?.dateFrom;
          const formattedTanggal = selectedDate
            ? new Date(selectedDate).toLocaleDateString("en-CA")
            : "";

          const filters = {
            namaPengirim: filterModel?.namaPengirim?.filter || "",
            namaPenerima: filterModel?.namaPenerima?.filter || "",
            tanggalKeberangkatan: formattedTanggal,
            totalHarga: "",
            barangFilter: filterModel?.barang?.filter || "",
          };

          try {
            const response = await fetch(`/api/infinite-scroll`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pagination: { page: currentPageNumber, limit },
                filters,
              }),
            });

            const result: FetchResponse = await response.json();
            setData(result);
            setIsLoading(false);
            const lastRow = result.totalData;
            if (result.data.length) {
              params.successCallback(result.data, lastRow);

              if (newPengirimanId && gridApiRef.current) {
                const rowIndex = result.data.findIndex(
                  (pengiriman) => pengiriman.id === newPengirimanId
                );

                console.log("Row Index: ", rowIndex); // Debugging
                if (rowIndex !== -1) {
                  setTimeout(() => {
                    gridApiRef.current?.ensureIndexVisible(rowIndex);
                    gridApiRef.current?.setFocusedCell(
                      rowIndex,
                      "namaPengirim"
                    );
                  }, 100); // Cobalah menambah delay di sini
                }
              }
            } else {
              params.failCallback();
            }
          } catch (error) {
            console.error("Failed to fetch data", error);
            params.failCallback();
            setIsLoading(false);
          }
        },
      };
      // params.api.setFocusedCell(0, "namaPengirim"); // Focus the first row
      setTimeout(() => {
        api.setFocusedCell(0, "namaPengirim");
        api.getRowNode("0")?.setSelected(true); // Pilih baris pertama
        api.ensureIndexVisible(0); // Pastikan baris pertama terlihat
      }, 0); // Timeout untuk memastikan grid sudah dirender
      params.api.setGridOption("datasource", dataSource);
    },
    [newPengirimanId]
  );
  const mutationDelete = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/kirim-barang`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries("pengiriman");
      window.location.reload();
    },
    onError: (error) => {
      console.error("Error deleting pengiriman", error);
    },
  });

  const handleDelete = () => {
    // Check if focusedRowIndex is valid
    if (focusedRowIndex === null || focusedRowIndex === undefined) {
      alert("Please select a row to delete.");
      return;
    }

    // Retrieve the row node safely
    const rowNode = gridApiRef.current?.getRowNode(focusedRowIndex.toString());
    // Check if rowNode is defined
    if (!rowNode) {
      alert("Row not found.");
      return;
    }

    // Extract the ID from the row node
    const idToDelete = rowNode.data?.id; // Use optional chaining here
    if (idToDelete === undefined) {
      alert("Unable to retrieve ID for deletion.");
      return;
    }

    mutationDelete.mutate(idToDelete);
    setFocusedRowIndex(focusedRowIndex);
  };

  const highlightText = (text: string | undefined, filterText: string) => {
    if (!text) return ""; // Handle undefined or null text

    if (!filterText) return text; // Return original text if there's no filter text

    const regex = new RegExp(`(${filterText})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) => (
      <span
        key={index}
        style={
          part.toLowerCase() === filterText.toLowerCase()
            ? { backgroundColor: "#aaa" }
            : {}
        }
      >
        {part}
      </span>
    ));
  };

  const handleEditClick = () => {
    if (selectedRow) {
      const formattedDate = new Date(selectedRow.tanggalKeberangkatan)
        .toISOString()
        .split("T")[0];
      setValue("tanggalKeberangkatan", formattedDate);

      setEditMode(true); // Masuk ke mode edit
      setValue("namaPengirim", selectedRow.namaPengirim);
      setValue("alamatPengirim", selectedRow.alamatPengirim);
      setValue("nohpPengirim", selectedRow.nohpPengirim);
      setValue("namaPenerima", selectedRow.namaPenerima);
      setValue("alamatPenerima", selectedRow.alamatPenerima);
      setValue("nohpPenerima", selectedRow.nohpPenerima);
      setValue("barang", selectedRow.barang);
      setValue("totalHarga", selectedRow.totalHarga);
      setValue("tanggalKeberangkatan", formattedDate);
      setPopOver(true); // Buka form dialog
    }
  };

  const columns: ColDef<Pengiriman>[] = [
    {
      headerName: "No.",
      maxWidth: 80,
      valueGetter: "node.id",
      suppressNavigable: true,
      cellRenderer: (props: CustomCellRendererProps) => {
        if (props.value !== undefined) {
          return props.node.rowIndex !== null ? props.node.rowIndex + 1 : 0;
        } else {
          return (
            <img src="https://www.ag-grid.com/example-assets/loading.gif" />
          );
        }
      },
      sortable: false,
      cellClass: "text-center",
    },
    {
      headerName: "Nama Pengirim",
      field: "namaPengirim",
      filter: "agTextColumnFilter",
      cellRenderer: (params: ICellRendererParams) => {
        const filterModel = params.api.getFilterModel();
        const filterText = filterModel.namaPengirim
          ? filterModel.namaPengirim.filter
          : "";
        return <div>{highlightText(params.value, filterText)}</div>;
      },
      floatingFilter: true,
    },
    {
      headerName: "Nama Penerima",
      field: "namaPenerima",
      filter: "agTextColumnFilter",
      cellRenderer: (params: ICellRendererParams) => {
        const filterModel = params.api.getFilterModel();
        const filterText = filterModel.namaPenerima
          ? filterModel.namaPenerima.filter
          : "";
        return <div>{highlightText(params.value, filterText)}</div>;
      },
      floatingFilter: true,
    },
    {
      headerName: "Total Harga",
      field: "totalHarga",
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    {
      headerName: "Tanggal Keberangkatan",
      field: "tanggalKeberangkatan",
      filter: "agDateColumnFilter",
      floatingFilter: true,
      valueGetter: (params: ValueGetterParams) => {
        const date = new Date(params?.data?.tanggalKeberangkatan);
        return date.toLocaleDateString("id-ID");
      },
    },
  ];

  const getRowClass = (params: RowClassParams) => {
    if (newPengirimanId && params.data && params.data.id === newPengirimanId) {
      return "ag-row-focus"; // Gaya fokus untuk baris yang memiliki ID baru
    }
    return "";
  };

  const onRowClicked = (event: RowClickedEvent) => {
    if (event.rowIndex !== null) {
      setFocusedRowIndex(event.rowIndex);
      setNewPengirimanId(null); // Reset newPengirimanId setelah baris dipilih
    }
    const rowData = event.data as Pengiriman;
    setSelectedRow(rowData);
  };

  const gridOptions: GridOptions<Pengiriman> = {
    defaultColDef: {
      editable: true,
      sortable: true,
      flex: 1,
      minWidth: 100,
      filter: true,
    },
    getRowClass,
    columnDefs: columns,
    onGridReady: (params) => {
      gridApiRef.current = params.api;
    },
  };

  const handleAdd = () => {
    setPopOver(true);
    setEditMode(false);
    reset();
  };
  const onDelete = () => {
    if (selectedRow) {
      const formattedDate = new Date(selectedRow.tanggalKeberangkatan)
        .toISOString()
        .split("T")[0];
      setValue("tanggalKeberangkatan", formattedDate);

      setEditMode(true); // Masuk ke mode edit
      setValue("namaPengirim", selectedRow.namaPengirim);
      setValue("alamatPengirim", selectedRow.alamatPengirim);
      setValue("nohpPengirim", selectedRow.nohpPengirim);
      setValue("namaPenerima", selectedRow.namaPenerima);
      setValue("alamatPenerima", selectedRow.alamatPenerima);
      setValue("nohpPenerima", selectedRow.nohpPenerima);
      setValue("barang", selectedRow.barang);
      setValue("totalHarga", selectedRow.totalHarga);
      setValue("tanggalKeberangkatan", formattedDate);
      setPopOver(true); // Buka form dialog
      setDeleteMode(true);
    }
  };
  useEffect(() => {
    if (data && data.data.length > 0 && gridApiRef.current) {
      const rowIndex =
        newPengirimanId !== null
          ? data.data.findIndex((p) => p.id === newPengirimanId)
          : -1;
      if (rowIndex >= 0) {
        gridApiRef.current.setFocusedCell(rowIndex, "namaPengirim");
      } else {
        gridApiRef.current.setFocusedCell(0, "namaPengirim"); // Fokus ke baris pertama jika tidak ada baris baru
      }
    }
  }, [data]);
  useEffect(() => {
    if (gridApiRef.current) {
      gridApiRef.current.addEventListener("paginationChanged", () => {
        const currentApi = gridApiRef.current;
        if (currentApi) {
          setFocusedRowIndex(relativeRowIndexRef.current);
          currentApi.setFocusedCell(
            relativeRowIndexRef.current,
            "namaPengirim"
          );
        }
      });
    }
  }, []);
  useEffect(() => {
    if (selectedRow) {
      setValue("barang", selectedRow.barang); // Pastikan 'barang' adalah array
    }
  }, [selectedRow, setValue]);

  useEffect(() => {
    const savedPengirimanId = localStorage.getItem("newPengirimanId");
    if (savedPengirimanId) {
      setNewPengirimanId(parseInt(savedPengirimanId));
      localStorage.removeItem("newPengirimanId"); // Hapus data setelah digunakan
    }
  }, []);
  React.useEffect(() => {
    calculateTotalHarga();
  }, [barang]);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="w-5/6 h-full p-10 bg-white shadow-md rounded-lg">
        <div className="ag-theme-alpine w-full" style={{ height: "600px" }}>
          <AgGridReact
            ref={gridRef}
            columnDefs={columns}
            rowModelType="infinite"
            cacheBlockSize={500}
            suppressHeaderFocus={true}
            maxBlocksInCache={500}
            getRowClass={getRowClass}
            onRowClicked={onRowClicked}
            animateRows={true}
            onGridReady={onGridReady}
            loading={isLoading}
            suppressCellFocus={false} // Make sure cell focus is enabled
            gridOptions={gridOptions} // Pass the entire gridOptions correctly
          />
        </div>
        <div className="mt-6 gap-2 flex">
          <Dialog open={popOver} onOpenChange={setPopOver}>
            {popOver ? (
              <DialogContent className="min-w-full h-lvh bg-white">
                <form
                  onSubmit={deleteMode ? handleDelete : handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1">Nama Pengirim</label>
                      <input
                        {...register("namaPengirim", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Alamat Pengirim</label>
                      <input
                        {...register("alamatPengirim", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">No HP Pengirim</label>
                      <input
                        {...register("nohpPengirim", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Nama Penerima</label>
                      <input
                        {...register("namaPenerima", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Alamat Penerima</label>
                      <input
                        {...register("alamatPenerima", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">No HP Penerima</label>
                      <input
                        {...register("nohpPenerima", { required: true })}
                        className="w-full border border-gray-300 p-2"
                        readOnly={deleteMode ? true : false}
                      />
                    </div>
                    <div>
                      <Label>Tanggal Keberangkatan</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-13",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? (
                              format(date, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(selectedDate) => {
                              setDate(selectedDate);
                              if (selectedDate) {
                                setValue(
                                  "tanggalKeberangkatan",
                                  selectedDate.toISOString().split("T")[0] // Set date in "YYYY-MM-DD" format
                                );
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold mb-4">Barang</h2>
                    {fields.map((item: Barang, index: number) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"
                      >
                        <div>
                          <label className="block mb-1">Nama Barang</label>
                          <select
                            disabled={deleteMode ? true : false}
                            {...register(`barang.${index}.barangId`, {
                              required: true,
                            })}
                            className="w-full border border-gray-300 p-2"
                            defaultValue={item.barangId} // Set default value from the data
                          >
                            <option value="">Pilih Barang</option>
                            {isLoadingBarang ? (
                              <option value="">Loading...</option>
                            ) : (
                              detailBarangOptions.map(
                                (barang: { id: string; nama: string }) => (
                                  <option key={barang.id} value={barang.id}>
                                    {barang.nama}
                                  </option>
                                )
                              )
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1">Jumlah Barang</label>
                          <input
                            type="number"
                            {...register(`barang.${index}.jumlahBarang`, {
                              required: true,
                              valueAsNumber: true,
                            })}
                            className="w-full border border-gray-300 p-2"
                            defaultValue={item.jumlahBarang} // Set default value from the data
                            readOnly={deleteMode ? true : false}
                          />
                        </div>
                        <div>
                          <label className="block mb-1">Harga Barang</label>
                          <input
                            type="number"
                            {...register(`barang.${index}.harga`, {
                              required: true,
                              valueAsNumber: true,
                            })}
                            className="w-full border border-gray-300 p-2"
                            defaultValue={item.harga} // Set default value from the data
                            readOnly={deleteMode ? true : false}
                          />
                        </div>
                        <div className="col-span-full">
                          <button
                            type="button"
                            className="text-red-500"
                            onClick={() => remove(index)}
                          >
                            Hapus Barang
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        append({ barangId: "", jumlahBarang: 1, harga: 0 })
                      }
                      className="text-blue-500"
                    >
                      Tambah Barang
                    </button>
                  </div>

                  <div>
                    <label className="block mb-1">Total Harga</label>
                    <input
                      type="number"
                      readOnly
                      {...register("totalHarga")}
                      className="w-full border border-gray-300 p-2"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </DialogContent>
            ) : (
              ""
            )}
          </Dialog>

          <ActionButton
            onEdit={handleEditClick}
            onDelete={onDelete}
            onAdd={handleAdd}
          />
        </div>
      </div>
    </div>
  );
};

export default PengirimanTable;
