package seed

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func Run(ctx context.Context, db *pgxpool.Pool, service string) error {
	switch service {
	case "hospital":
		return hospital(ctx, db)
	case "bpjs":
		return bpjs(ctx, db)
	case "insurer":
		return insurer(ctx, db)
	default:
		return fmt.Errorf("unknown service %q", service)
	}
}

func passwordHash(value string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(value), bcrypt.DefaultCost)
	return string(hash), err
}

func hospital(ctx context.Context, db *pgxpool.Pool) error {
	hash, err := passwordHash("KasirRS#2025")
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO users(email,password_hash,full_name,role_title,role,hospital_name)
		VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING`,
		"siti.rahmawati@rs-jantung.co.id", hash, "Siti Rahmawati, S.Kep",
		"Admin Billing & Casemix", "ADMIN_BILLING_RS", "RS Jantung Nusantara")
	if err != nil {
		return err
	}
	names := []string{"Aulia Ramadhani", "Budi Santoso", "Siti Rahayu", "Ahmad Wijaya", "Dewi Lestari"}
	niks := []string{"3171092837480001", "3171092837480002", "3171092837480003", "3171092837480004", "3171092837480005"}
	patientIDs := make([]int64, len(names))
	for i := range names {
		err = db.QueryRow(ctx, `
			INSERT INTO patients(patient_code,nik,full_name,birth_date,gender,phone,email,address)
			VALUES($1,$2,$3,$4,$5,'08000000000','demo@example.test','Alamat simulasi')
			ON CONFLICT(nik) DO UPDATE SET full_name=EXCLUDED.full_name
			RETURNING id`,
			fmt.Sprintf("PAT-2026-%03d", i+1), niks[i], names[i], time.Date(1990+i, time.January, 1, 0, 0, 0, 0, time.UTC), []string{"P", "L", "P", "L", "P"}[i],
		).Scan(&patientIDs[i])
		if err != nil {
			return err
		}
		_, err = db.Exec(ctx, `
			INSERT INTO patient_coverages(patient_id,payer_tier,payer_type,insurer_name,card_or_policy_number,care_class,primary_faskes,plan_name,annual_limit,remaining_limit,room_daily_limit,valid_until)
			VALUES($1,'PRIMARY','BPJS','BPJS Kesehatan',$2,'Kelas 1','Faskes Simulasi','',0,0,0,'2026-12-31')
			ON CONFLICT(payer_type,card_or_policy_number) DO NOTHING`,
			patientIDs[i], fmt.Sprintf("0001827392%03d", i+1))
		if err != nil {
			return err
		}
		if i == 0 || i == 2 || i == 4 {
			_, err = db.Exec(ctx, `
				INSERT INTO patient_coverages(patient_id,payer_tier,payer_type,insurer_name,card_or_policy_number,plan_name,annual_limit,remaining_limit,room_daily_limit,valid_until)
				VALUES($1,'SECONDARY','PRIVATE_INSURANCE','Asuransi Sehat Sentosa',$2,'Gold Executive Inpatient',200000000,200000000,3500000,'2027-12-31')
				ON CONFLICT(payer_type,card_or_policy_number) DO NOTHING`,
				patientIDs[i], fmt.Sprintf("GOLD-EXEC-88910%d", i+1))
			if err != nil {
				return err
			}
		}
	}
	var caseID int64
	err = db.QueryRow(ctx, `
		INSERT INTO medical_cases(case_number,patient_id,care_type,room_name,entitled_class,dpjp_name,admission_date,discharge_date,diagnosis_icd10,diagnosis_desc,procedure_icd9,procedure_desc,ina_cbg_code,ina_cbg_tariff,total_hospital_bill,simulation_mode,workflow_step,coordination_status)
		VALUES('KAS-2026-001',$1,'RAWAT_INAP','Paviliun Kartika (Bed 402-A)','Eksekutif','dr. Hendra Wicaksono','2026-10-08','2026-10-12','I20.0','Unstable Angina Pectoris','00.66','PTCA / Stent','I-4-10-II',50000000,125000000,'COB',1,'IN_PROGRESS')
		ON CONFLICT(case_number) DO UPDATE SET case_number=EXCLUDED.case_number
		RETURNING id`, patientIDs[0]).Scan(&caseID)
	if err != nil {
		return err
	}
	var itemCount int
	if err = db.QueryRow(ctx, `SELECT COUNT(*) FROM case_bill_items WHERE case_id=$1`, caseID).Scan(&itemCount); err != nil {
		return err
	}
	if itemCount == 0 {
		_, err = db.Exec(ctx, `
			INSERT INTO case_bill_items(case_id,category,description,unit_info,unit_price,quantity,subtotal)
			VALUES
			($1,'AKOMODASI','Kamar Rawat Inap VVIP','5 Hari',3500000,5,17500000),
			($1,'TINDAKAN','Tindakan kateterisasi jantung','1 Prosedur',82000000,1,82000000),
			($1,'FARMASI','Farmasi, obat dan alkes','Paket',18250000,1,18250000),
			($1,'LABORATORIUM','Laboratorium, Troponin dan EKG','Paket',7250000,1,7250000)`, caseID)
		if err != nil {
			return err
		}
	}
	var bpjsCoverageID, insurerCoverageID int64
	if err = db.QueryRow(ctx, `SELECT id FROM patient_coverages WHERE patient_id=$1 AND payer_type='BPJS' LIMIT 1`, patientIDs[0]).Scan(&bpjsCoverageID); err != nil {
		return err
	}
	if err = db.QueryRow(ctx, `SELECT id FROM patient_coverages WHERE patient_id=$1 AND payer_type='PRIVATE_INSURANCE' LIMIT 1`, patientIDs[0]).Scan(&insurerCoverageID); err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO subclaims(subclaim_code,case_id,coverage_id,payer_type,payer_name,requested_amount,status)
		VALUES
			('SUB-BPJS-001',$1,$2,'BPJS','BPJS Kesehatan',37500000,'DRAFT'),
			('SUB-AST-002',$1,$3,'PRIVATE_INSURANCE','Asuransi Sehat Sentosa',72500000,'DRAFT')
		ON CONFLICT(subclaim_code) DO NOTHING`, caseID, bpjsCoverageID, insurerCoverageID)
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO split_bill_simulations(case_id,preset_name,bpjs_percent,insurer_percent,patient_percent,total_bill,
			reference_tariff,bpjs_estimated,insurer_estimated,patient_estimated,patient_final_excess,is_applied)
		VALUES($1,'ARBITRARY_COB_30_58_12',30,58,12,125000000,50000000,37500000,72500000,15000000,15000000,FALSE)
		ON CONFLICT(case_id) DO NOTHING`, caseID)
	if err != nil {
		return err
	}
	return nil
}

func bpjs(ctx context.Context, db *pgxpool.Pool) error {
	hash, err := passwordHash("reviewerBpjs2025!")
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO bpjs_users(email,password_hash,full_name,role_title,branch_name)
		VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING`,
		"triana.mayasari@bpjs-kesehatan.go.id", hash, "dr. Triana M., Sp.A",
		"Reviewer Medis & Administrasi", "BPJS Cabang Utama")
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO bpjs_claims(subclaim_code,case_number,hospital_name,patient_snapshot,coverage_snapshot,clinical_snapshot,financial_snapshot,documents_snapshot,requested_amount,status)
		VALUES('SUB-BPJS-001','KAS-2026-001','RS Jantung Nusantara',
			'{"full_name":"Aulia Ramadhani"}'::jsonb,
			'{"payer_type":"BPJS","care_class":"Kelas 1"}'::jsonb,
			'{"diagnosis_icd10":"I20.0","procedure_icd9":"00.66"}'::jsonb,
			'{"requested_amount":37500000,"total_hospital_bill":125000000}'::jsonb,
			'[]'::jsonb,37500000,'SUBMITTED')
		ON CONFLICT(subclaim_code) DO NOTHING`)
	return err
}

func insurer(ctx context.Context, db *pgxpool.Pool) error {
	hash, err := passwordHash("SecurityToken@2025!")
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO insurer_users(email,password_hash,full_name,role_title,insurer_entity_name,authority_limit)
		VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING`,
		"bambang.sudarsono@sehatsentosa.co.id", hash, "Bambang Sudarsono, S.E., AAK",
		"Senior Claim Underwriter", "PT Asuransi Sehat Sentosa", 100000000)
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, `
		INSERT INTO insurer_claims(subclaim_code,case_number,hospital_name,insurer_entity_name,patient_snapshot,policy_snapshot,clinical_snapshot,cost_breakdown_snapshot,documents_snapshot,requested_amount,status)
		VALUES('SUB-AST-002','KAS-2026-001','RS Jantung Nusantara','PT Asuransi Sehat Sentosa',
			'{"full_name":"Aulia Ramadhani"}'::jsonb,
			'{"plan_name":"Gold Executive Inpatient","annual_limit":200000000}'::jsonb,
			'{"diagnosis_icd10":"I20.0","procedure_icd9":"00.66"}'::jsonb,
			'{"requested_amount":72500000,"primary_payer_approved":37500000}'::jsonb,
			'[]'::jsonb,72500000,'SUBMITTED')
		ON CONFLICT(subclaim_code) DO NOTHING`)
	return err
}
