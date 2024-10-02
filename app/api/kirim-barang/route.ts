import { NextRequest, NextResponse } from "next/server";
import knex from "../../../knex";

// Define the types for the request payload
interface Barang {
  barangId: string; // Assumed this is a string to match your DB
  jumlahBarang: number;
  harga: number;
}

interface PengirimanRequest {
  namaPengirim: string;
  alamatPengirim: string;
  nohpPengirim: string;
  namaPenerima: string;
  alamatPenerima: string;
  nohpPenerima: string;
  tanggalKeberangkatan: string; // Keeping it as string because it might be in ISO format
  totalHarga: number;
  barang: Barang[];
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the incoming request body
    const {
      namaPengirim,
      nohpPengirim,
      alamatPengirim,
      namaPenerima,
      alamatPenerima,
      nohpPenerima,
      tanggalKeberangkatan,
      totalHarga,
      barang,
    }: PengirimanRequest = await request.json();

    // Basic validation
    if (
      !namaPengirim ||
      !namaPengirim ||
      !tanggalKeberangkatan ||
      !nohpPengirim ||
      !alamatPengirim ||
      !alamatPenerima ||
      !nohpPenerima ||
      !barang ||
      !barang.length
    ) {
      return NextResponse.json(
        { error: "Missing required fields or no items in barang" },
        { status: 400 }
      );
    }

    // Use transaction to insert into both `pengiriman` and `barang`
    const insertedPengirimanData = await knex.transaction(async (trx) => {
      // Insert into the `pengiriman` table
      const [pengirimanId] = await trx("pengiriman")
        .insert({
          namaPengirim,
          nohpPengirim,
          alamatPengirim,
          namaPenerima,
          alamatPenerima,
          nohpPenerima,
          tanggalKeberangkatan: new Date(tanggalKeberangkatan), // Parse the date
          totalHarga: parseFloat(totalHarga.toString()), // Ensure totalHarga is a float
        })
        .returning("id");

      // Check the incoming barang data
      console.log("Incoming Barang Data:", barang); // Log the incoming barang data

      // Insert barang details into the `barang` table
      const barangData = barang.map((item: Barang) => {
        console.log("Barang Item:", item); // Log each barang item

        return {
          pengirimanId,
          barangId: item.barangId, // Make sure this is correct
          jumlahBarang: item.jumlahBarang,
          harga: parseFloat(item.harga.toString()), // Ensure harga is a float
        };
      });

      await trx("barang").insert(barangData);

      // Return the inserted pengiriman and barang data
      return {
        pengirimanId,
        pengiriman: {
          namaPengirim,
          nohpPengirim,
          alamatPengirim,
          namaPenerima,
          alamatPenerima,
          nohpPenerima,
          tanggalKeberangkatan,
          totalHarga,
          barang: barangData,
        },
      };
    });

    // Success response
    return NextResponse.json({
      message: "Pengiriman berhasil ditambahkan",
      data: insertedPengirimanData,
    });
  } catch (error) {
    console.error("Error inserting pengiriman:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate the incoming request body
    const { id }: { id: string } = await request.json();

    // Basic validation
    if (!id) {
      return NextResponse.json(
        { error: "Missing pengiriman ID in the request body" },
        { status: 400 }
      );
    }

    // Use transaction to delete from `pengiriman` and `barang`
    await knex.transaction(async (trx) => {
      // First, delete the associated `barang` entries
      await trx("barang").where({ pengirimanId: id }).delete();

      // Then, delete the `pengiriman` record itself
      const deletedRows = await trx("pengiriman").where({ id }).delete();

      // If no rows were deleted, the ID doesn't exist
      if (deletedRows === 0) {
        throw new Error("Pengiriman not found");
      }
    });

    // Success response
    return NextResponse.json({
      message: "Pengiriman berhasil dihapus",
    });
  } catch (error) {
    console.error("Error deleting pengiriman:", error);

    // Generic error response for other issues
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}