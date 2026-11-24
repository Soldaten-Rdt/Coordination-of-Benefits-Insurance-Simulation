"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { useWorkspace } from "@/components/layout";
import { createCase, listPatients } from "@/lib/api/cases";
import { ApiClientError } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/token";
import type { PatientOption } from "@/types/case";
import { FieldError, inputClass, labelClass, Panel } from "./case-ui";

type BillRow = {
  category: "AKOMODASI" | "TINDAKAN" | "FARMASI" | "LABORATORIUM";
  description: string;
  unit_info: string;
  unit_price: string;
  quantity: string;
};

const blankItem = (): BillRow => ({
  category: "AKOMODASI",
  description: "",
  unit_info: "",
  unit_price: "",
  quantity: "1",
});

export function CaseCreatePage() {
  const router = useRouter();
  const { simulationMode } = useWorkspace();
  const { toast } = useToast();
  const [patientQuery, setPatientQuery] = React.useState("");
  const [patients, setPatients] = React.useState<PatientOption[]>([]);
  const [patientId, setPatientId] = React.useState("");
  const [loadingPatients, setLoadingPatients] = React.useState(true);
  const [patientError, setPatientError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [form, setForm] = React.useState({
    care_type: "RAWAT_INAP" as "RAWAT_INAP" | "RAWAT_JALAN",
    room_name: "",
    entitled_class: "",
    dpjp_name: "",
    admission_date: new Date().toLocaleDateString("en-CA"),
    discharge_date: "",
    diagnosis_icd10: "",
    diagnosis_desc: "",
    procedure_icd9: "",
    procedure_desc: "",
    ina_cbg_code: "",
    ina_cbg_tariff: "",
  });
  const [items, setItems] = React.useState<BillRow[]>([blankItem()]);

  React.useEffect(() => {
    if (!getAccessToken()) {
      setLoadingPatients(false);
      setPatientError("Silakan masuk terlebih dahulu untuk membuat kasus.");
      return;
    }
    let active = true;
    setLoadingPatients(true);
    listPatients({ page: 1, limit: 100, q: patientQuery })
      .then((response) => {
        if (active) setPatients(response.data ?? []);
      })
      .catch((cause: unknown) => {
        if (active) {
          setPatientError(
            cause instanceof Error ? cause.message : "Daftar pasien gagal dimuat."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingPatients(false);
      });
    return () => {
      active = false;
    };
  }, [patientQuery]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };

  const updateItem = (index: number, key: keyof BillRow, value: string) => {
    setItems((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item
      )
    );
    setFieldErrors((current) => ({ ...current, bill_items: "" }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    const invalidItems = items.some(
      (item) =>
        !item.description.trim() ||
        Number(item.unit_price) < 0 ||
        !Number(item.quantity) ||
        Number(item.quantity) <= 0 ||
        !Number.isInteger(Number(item.unit_price) * Number(item.quantity))
    );
    if (invalidItems) {
      setFieldErrors({
        bill_items:
          "Isi uraian, harga satuan bulat, dan jumlah lebih dari nol untuk setiap item.",
      });
      return;
    }
    setSaving(true);
    try {
      const response = await createCase({
        patient_id: Number(patientId),
        ...form,
        ina_cbg_tariff: Number(form.ina_cbg_tariff || 0),
        simulation_mode: simulationMode,
        bill_items: items.map((item) => ({
          category: item.category,
          description: item.description.trim(),
          unit_info: item.unit_info.trim(),
          unit_price: Number(item.unit_price),
          quantity: Number(item.quantity),
        })),
      });
      toast({
        title: "Kasus berhasil dibuat",
        description: `${response.data.case_number} siap dilengkapi.`,
        variant: "success",
      });
      router.push(`/cases/${response.data.id}`);
    } catch (cause: unknown) {
      if (cause instanceof ApiClientError) {
        setFieldErrors(cause.fieldErrors);
        toast({
          title: cause.message,
          description: Object.values(cause.fieldErrors).join(" "),
          variant: "error",
        });
      } else {
        toast({
          title: "Kasus gagal dibuat",
          description:
            cause instanceof Error ? cause.message : "Terjadi kesalahan.",
          variant: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#55758D] hover:text-[#0B3A5B]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke kasus
        </Link>
        <h1 className="mt-3 text-[22px] font-extrabold text-[#0B3A5B]">
          Buat kasus perawatan
        </h1>
        <p className="mt-1 text-xs text-[#5B6B7B]">
          Masukkan data klinis dan rincian tagihan. Status akhir akan mengikuti
          hasil backend.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Panel
          title="Pasien dan episode perawatan"
          description={`Mode simulasi aktif: ${simulationMode === "COB" ? "COB (BPJS + asuransi swasta jika tersedia)" : "NON_COB (BPJS saja)"}.`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="patient-search">
                Cari dan pilih pasien *
              </label>
              <input
                id="patient-search"
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
                placeholder="Cari nama, kode pasien, atau NIK"
                className={inputClass}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {loadingPatients ? (
                  <span className="text-[11px] text-[#6B8091]">
                    Memuat pasien...
                  </span>
                ) : patientError ? (
                  <span className="text-[11px] text-rose-700">
                    {patientError}
                  </span>
                ) : patients.length === 0 ? (
                  <span className="text-[11px] text-[#6B8091]">
                    Pasien tidak ditemukan.
                  </span>
                ) : (
                  patients.map((patient) => (
                    <button
                      type="button"
                      key={patient.id}
                      onClick={() => setPatientId(String(patient.id))}
                      className={`rounded-lg border px-3 py-2 text-left text-[11px] transition ${
                        patientId === String(patient.id)
                          ? "border-[#2D6C91] bg-[#EEF6FB] ring-1 ring-[#2D6C91]/20"
                          : "border-[#E3EAF5] bg-white hover:bg-[#F7FAFD]"
                      }`}
                    >
                      <span className="block font-bold text-[#0B3A5B]">
                        {patient.full_name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[#6E8294]">
                        {patient.patient_code} · NIK {patient.nik}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <FieldError>{fieldErrors.patient_id}</FieldError>
            </div>
            <div>
              <label className={labelClass} htmlFor="care-type">
                Jenis perawatan *
              </label>
              <select
                id="care-type"
                value={form.care_type}
                onChange={(event) =>
                  updateForm(
                    "care_type",
                    event.target.value as "RAWAT_INAP" | "RAWAT_JALAN"
                  )
                }
                className={inputClass}
              >
                <option value="RAWAT_INAP">Rawat inap</option>
                <option value="RAWAT_JALAN">Rawat jalan</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="room">
                Ruang / unit
              </label>
              <input
                id="room"
                value={form.room_name}
                onChange={(event) => updateForm("room_name", event.target.value)}
                placeholder="Contoh: Anggrek 204"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="class">
                Kelas hak
              </label>
              <input
                id="class"
                value={form.entitled_class}
                onChange={(event) =>
                  updateForm("entitled_class", event.target.value)
                }
                placeholder="Contoh: Kelas 1"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="dpjp">
                DPJP *
              </label>
              <input
                id="dpjp"
                value={form.dpjp_name}
                onChange={(event) => updateForm("dpjp_name", event.target.value)}
                className={inputClass}
                required
              />
              <FieldError>{fieldErrors.dpjp_name}</FieldError>
            </div>
            <div>
              <label className={labelClass} htmlFor="admission-date">
                Tanggal masuk *
              </label>
              <input
                id="admission-date"
                type="date"
                value={form.admission_date}
                onChange={(event) =>
                  updateForm("admission_date", event.target.value)
                }
                className={inputClass}
                required
              />
              <FieldError>{fieldErrors.admission_date}</FieldError>
            </div>
            <div>
              <label className={labelClass} htmlFor="discharge-date">
                Tanggal keluar
              </label>
              <input
                id="discharge-date"
                type="date"
                value={form.discharge_date}
                min={form.admission_date}
                onChange={(event) =>
                  updateForm("discharge_date", event.target.value)
                }
                className={inputClass}
              />
              <FieldError>{fieldErrors.discharge_date}</FieldError>
            </div>
          </div>
        </Panel>

        <Panel
          title="Diagnosis, tindakan, dan tarif"
          description="Gunakan kode ICD-10 dan ICD-9-CM sesuai rekam medis."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["diagnosis_icd10", "Kode diagnosis ICD-10 *"],
                ["diagnosis_desc", "Deskripsi diagnosis"],
                ["procedure_icd9", "Kode prosedur ICD-9-CM"],
                ["procedure_desc", "Deskripsi prosedur"],
                ["ina_cbg_code", "Kode INA-CBG"],
                ["ina_cbg_tariff", "Tarif INA-CBG (Rp)"],
              ] as const
            ).map(([name, label]) => (
              <div key={name}>
                <label className={labelClass} htmlFor={name}>
                  {label}
                </label>
                <input
                  id={name}
                  type={name === "ina_cbg_tariff" ? "number" : "text"}
                  min={name === "ina_cbg_tariff" ? "0" : undefined}
                  step="1"
                  value={form[name]}
                  onChange={(event) => updateForm(name, event.target.value)}
                  className={inputClass}
                  required={name === "diagnosis_icd10"}
                />
                <FieldError>{fieldErrors[name]}</FieldError>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Rincian tagihan"
          description="Tambahkan minimal satu item; subtotal dan total dihitung saat disimpan oleh server."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setItems((current) => [...current, blankItem()])}
            >
              Tambah item
            </Button>
          }
        >
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-[#E6ECF3] p-3 md:grid-cols-[150px_minmax(180px,1fr)_120px_140px_90px_34px]"
              >
                <div>
                  <label className={labelClass}>Kategori</label>
                  <select
                    value={item.category}
                    onChange={(event) =>
                      updateItem(index, "category", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="AKOMODASI">Akomodasi</option>
                    <option value="TINDAKAN">Tindakan</option>
                    <option value="FARMASI">Farmasi</option>
                    <option value="LABORATORIUM">Laboratorium</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Uraian *</label>
                  <input
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, "description", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Nama layanan / obat"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Info satuan</label>
                  <input
                    value={item.unit_info}
                    onChange={(event) =>
                      updateItem(index, "unit_info", event.target.value)
                    }
                    className={inputClass}
                    placeholder="hari, unit"
                  />
                </div>
                <div>
                  <label className={labelClass}>Harga satuan (Rp) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.unit_price}
                    onChange={(event) =>
                      updateItem(index, "unit_price", event.target.value)
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Jumlah *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    aria-label={`Hapus item tagihan ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                    className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[#9A5362] hover:bg-rose-50 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <FieldError>{fieldErrors.bill_items}</FieldError>
          </div>
        </Panel>

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Link
            href="/cases"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#DDE6EF] px-4 text-xs font-bold text-[#46657B] hover:bg-white"
          >
            Batal
          </Link>
          <Button type="submit" isLoading={saving} disabled={!patientId}>
            Buat kasus dan lanjutkan
          </Button>
        </div>
      </form>
    </div>
  );
}
