import { NextRequest, NextResponse } from "next/server";
import knex from "../../../knex";
import { Pengiriman } from "@/app/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { filters, sort } = await request.json();

    // Base query for fetching pengiriman and related barang and detail_barang data
    const baseQuery = knex("pengiriman")
      .leftJoin("barang", "pengiriman.id", "barang.pengirimanId")
      .leftJoin("detail_barang", "barang.barangId", "detail_barang.id")
      .select(
        "pengiriman.*",
        "barang.barangId", // Ambil barangId dari tabel barang
        "detail_barang.nama as namaBarang",
        "barang.jumlahBarang",
        "barang.harga" // Include harga to ensure it is available in the result
      );

    // Apply filters to the query
    if (filters?.namaPengirim && filters.namaPengirim.trim() !== "") {
      baseQuery.where(
        "pengiriman.namaPengirim",
        "like",
        `%${filters.namaPengirim}%`
      );
    }
    if (filters?.namaPenerima && filters.namaPenerima.trim() !== "") {
      baseQuery.where(
        "pengiriman.namaPenerima",
        "like",
        `%${filters.namaPenerima}%`
      );
    }
    if (
      filters?.tanggalKeberangkatan &&
      filters.tanggalKeberangkatan.trim() !== ""
    ) {
      const tanggalKeberangkatan = filters.tanggalKeberangkatan;
      baseQuery.whereRaw("DATE(pengiriman.tanggalKeberangkatan) = ?", [
        tanggalKeberangkatan,
      ]);
    }
    if (filters?.totalHarga && filters.totalHarga.trim() !== "") {
      baseQuery.where(
        "pengiriman.totalHarga",
        "=",
        parseFloat(filters.totalHarga)
      );
    }
    if (filters?.barangFilter && filters.barangFilter.trim() !== "") {
      baseQuery.whereExists(function () {
        this.select("*")
          .from("barang")
          .leftJoin("detail_barang", "barang.barangId", "detail_barang.id")
          .whereRaw("barang.pengirimanId = pengiriman.id")
          .andWhere("detail_barang.nama", "like", `%${filters.barangFilter}%`);
      });
    }

    // Apply sorting
    if (sort?.column && sort?.direction) {
      // Validate column name to prevent SQL injection by using a whitelist approach
      const sortableColumns = [
        "pengiriman.namaPengirim",
        "pengiriman.namaPenerima",
        "pengiriman.tanggalKeberangkatan",
        "pengiriman.totalHarga",
        "barang.namaBarang",
        "barang.harga",
        "barang.jumlahBarang",
      ];
      
      if (sortableColumns.includes(sort.column)) {
        baseQuery.orderBy(sort.column, sort.direction);
      } else {
        console.warn(`Invalid column for sorting: ${sort.column}`);
      }
    } else {
      // Default sorting if no sort parameter is provided
      baseQuery.orderBy("pengiriman.namaPengirim", "asc");
    }

    // Count total data without pagination
    const totalQuery = knex("pengiriman");
    if (filters?.namaPengirim && filters.namaPengirim.trim() !== "") {
      totalQuery.where("namaPengirim", "like", `%${filters.namaPengirim}%`);
    }
    if (filters?.namaPenerima && filters.namaPenerima.trim() !== "") {
      totalQuery.where("namaPenerima", "like", `%${filters.namaPenerima}%`);
    }
    if (
      filters?.tanggalKeberangkatan &&
      filters.tanggalKeberangkatan.trim() !== ""
    ) {
      const tanggalKeberangkatan = filters.tanggalKeberangkatan;
      totalQuery.whereRaw("DATE(pengiriman.tanggalKeberangkatan) = ?", [
        tanggalKeberangkatan,
      ]);
    }
    if (filters?.totalHarga && filters.totalHarga.trim() !== "") {
      totalQuery.where("totalHarga", "=", parseFloat(filters.totalHarga));
    }
    if (filters?.barangFilter && filters.barangFilter.trim() !== "") {
      totalQuery.whereExists(function () {
        this.select("*")
          .from("barang")
          .leftJoin("detail_barang", "barang.barangId", "detail_barang.id")
          .whereRaw("barang.pengirimanId = pengiriman.id")
          .andWhere("detail_barang.nama", "like", `%${filters.barangFilter}%`);
      });
    }

    const [{ count }] = await totalQuery.count({ count: "*" });

    // Handle undefined count with default value
    const totalCount = count ? parseInt(count as string) : 0;

    const pengirimanDataRaw = await baseQuery;

    // Group the results and build the JSON structure
    const pengirimanData: Pengiriman[] = pengirimanDataRaw.reduce(
      (acc: Pengiriman[], row) => {
        const existing = acc.find((item) => item.id === row.id);
        if (existing) {
          // Add barang to existing entry
          existing.barang.push({
            id: row.barangId,
            barangId: row.barangId, // Ensure barangId is included
            namaBarang: row.namaBarang,
            jumlahBarang: row.jumlahBarang,
            harga: row.harga, // Price of the barang
          });
        } else {
          // Create a new entry
          acc.push({
            ...row,
            barang: [
              {
                id: row.barangId,
                barangId: row.barangId, // Ensure barangId is included
                namaBarang: row.namaBarang,
                jumlahBarang: row.jumlahBarang,
                harga: row.harga, // Include harga as well
              },
            ],
          });
        }
        return acc;
      },
      []
    );

    // Log the base query for debugging
    console.log("Generated Query:", baseQuery.toString());

    return NextResponse.json({
      totalData: totalCount,
      data: pengirimanData, // Return all data
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
