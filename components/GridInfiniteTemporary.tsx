/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";
import { AgGridReact, CustomCellRendererProps } from "ag-grid-react";
import { useInfiniteQuery } from "react-query";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef, GridApi, IGetRowsParams } from "ag-grid-community";
interface Pengiriman {
  id: number;
  namaPengirim: string;
  namaPenerima: string;
  tanggalKeberangkatan: string;
  totalHarga: number;
  barang: Array<{
    barangId: number;
    namaBarang: string;
    jumlahBarang: number;
    harga: number;
  }>;
}
interface PageData {
  data: Pengiriman[];
  nextPage: number | undefined;
  totalData: number;
}
interface SortModel {
  column: string;
  direction: "asc" | "desc" | null; // Mengizinkan null jika kolom tidak disortir
}
const GridInfiniteTemporary = () => {
  const [sortModel, setSortModel] = useState<SortModel[]>([]);

  const [filterModel, setFilterModel] = useState<any>({}); // Menyimpan model filter
  const limit = 25; // Limit per page
  const gridApiRef = useRef<GridApi | null>(null);
  const fetchData = async ({ pageParam = 0 }): Promise<PageData> => {
    const pagination = {
      page: pageParam,
      limit: limit,
    };

    const body = JSON.stringify({
      filters: filterModel,
      pagination,
      sort: sortModel && Array.isArray(sortModel) ? sortModel : null,
    });

    const res = await fetch("/api/temporary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    });

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }

    const responseData = await res.json();

    // Pastikan Anda mengembalikan data dengan struktur yang diinginkan
    return {
      data: responseData.data, // Mengambil data dari respons
      nextPage: responseData.nextPage, // Mengambil nextPage dari respons
      totalData: responseData.totalData, // Total data
    };
  };

  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useInfiniteQuery<PageData>(["data", sortModel, filterModel], fetchData, {
      getNextPageParam: (lastPage) => lastPage.nextPage,
      refetchOnWindowFocus: false,
    });
  const onScrollEnd = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage(); // Memanggil fetchNextPage saat menggulir ke bawah
    }
  };

  const onGridReady = (params: any) => {
    gridApiRef.current = params.api;
    params.api.addEventListener("bodyScrollEnd", onScrollEnd);
  };
  // Fungsi untuk menangani perubahan filter
  const onFilterChanged = () => {
    const newFilterModel = gridApiRef.current?.getFilterModel() || {};
    setFilterModel(newFilterModel);
    gridApiRef.current?.paginationGoToPage(0); // Reset ke halaman pertama
    refetch(); // Mengambil data untuk filter baru
  };

  const datasource = {
    getRows: async (params: IGetRowsParams) => {
      const page = Math.floor(params.startRow / limit);
      try {
        const res = await fetchData({ pageParam: page });
        const rowsThisPage = res.data;
        const lastRow = res.totalData;

        params.successCallback(rowsThisPage, lastRow);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        params.failCallback();
      }
    },
  };
  const columnDefs: ColDef[] = [
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
      field: "namaPengirim",
      headerName: "Nama Pengirim",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    {
      field: "namaPenerima",
      headerName: "Nama Penerima",
      sortable: true,
      filter: "agTextColumnFilter",
      floatingFilter: true,
    },
    {
      field: "tanggalKeberangkatan",
      headerName: "Tanggal Keberangkatan",
      sortable: true,
      filter: "agDateColumnFilter",
      floatingFilter: true,
    },
    {
      field: "totalHarga",
      headerName: "Total Harga",
      sortable: true,
      filter: "agNumberColumnFilter",
      floatingFilter: true,
    },
  ];

  useEffect(() => {
    if (gridApiRef.current) {
      gridApiRef.current.setGridOption("datasource", datasource);
    }
  }, [datasource]);
  return (
    <div className="w-full flex items-center justify-center">
      <div className="w-5/6 h-full p-10 bg-white shadow-md rounded-lg">
        <div className="ag-theme-alpine w-full" style={{ height: "600px" }}>
          <AgGridReact
            columnDefs={columnDefs}
            rowModelType="infinite"
            onGridReady={onGridReady}
            onFilterChanged={onFilterChanged} // Listener untuk perubahan filter
            defaultColDef={{
              sortable: true,
              filter: true, // Mengaktifkan filter untuk semua kolom secara default
              floatingFilter: true, // Mengaktifkan floating filter
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default GridInfiniteTemporary;
