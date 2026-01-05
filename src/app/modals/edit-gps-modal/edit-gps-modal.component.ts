import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith, Subscription } from 'rxjs';

type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado';

export interface EditGpsOpenData {
  id: string;
  imei: string;
  sn: string;
  name: string;
  brand: string;
  model: string;
  status: DeviceStatus;
  purchaseDate: string | Date | null;
  entryDate: string | Date | null;
  installationDate?: string | Date | null;
  client?: string | null;
  comments?: string | null;
}

type GpsEditableKeys =
  | 'imei' | 'sn' | 'name' | 'brand' | 'model' | 'status'
  | 'purchaseDate' | 'entryDate' | 'installationDate'
  | 'client' | 'comments';


@Component({
  selector: 'app-edit-gps-modal',
  templateUrl: './edit-gps-modal.component.html',
  styleUrl: './edit-gps-modal.component.scss'
})
export class EditGpsModalComponent {
  @Input() modelOptions: string[] = [];
  @Input() brandOptions: string[] = [];

  @Output() gpsUpdated = new EventEmitter<{
    id: string;
    payload: Partial<{
      imei: string;
      sn: string;
      name: string;
      brand: string;
      model: string;
      status: DeviceStatus;
      purchaseDate: string;
      entryDate: string;
      installationDate: string | null;
      client: string | null;
      comments: string | null;
    }>;
  }>();

  show = false;
  form!: FormGroup;
  loading = false;
  private currentId: string | null = null;

  filteredModels$!: Observable<string[]>;
  filteredBrands$!: Observable<string[]>;

  hasChanges = false;
  private initialSnapshot: any = null;
  private changesSub?: Subscription;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      imei: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.minLength(14), Validators.maxLength(20)]],
      sn: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      name: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      status: ['En inventario', Validators.required],
      purchaseDate: [null, Validators.required],
      entryDate: [null, Validators.required],
      installationDate: [null],
      client: [''],
      comments: [''],
    });

    this.filteredModels$ = this.form.get('model')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.modelOptions))
    );
    this.filteredBrands$ = this.form.get('brand')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.brandOptions))
    );
  }

  // ===== Helpers =====
  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  private toDate(d: any): Date | null {
    if (!d) return null;
    if (d instanceof Date) return d;
    const iso = new Date(d);
    if (isNaN(iso.getTime())) return null;
    // crear fecha local usando Y-M-D UTC (evita “un día menos”)
    return new Date(iso.getUTCFullYear(), iso.getUTCMonth(), iso.getUTCDate());
  }

  private toYMD(d: any): string {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private emptyToNull(s: any) {
    const t = (s ?? '').toString().trim();
    return t === '' ? null : t;
  }

  private snapshotForm(): Record<GpsEditableKeys, any> {
    const v = this.form.getRawValue();
    const toKey = (x: any) => (x ? this.toYMD(x) : null);
    const t = (s: any) => (s ?? '').toString().trim();

    return {
      imei: t(v.imei),
      sn: t(v.sn),
      name: t(v.name),
      brand: t(v.brand),
      model: t(v.model),
      status: t(v.status),
      purchaseDate: toKey(v.purchaseDate),
      entryDate: toKey(v.entryDate),
      installationDate: v.installationDate ? toKey(v.installationDate) : null,
      client: t(v.client),
      comments: t(v.comments),
    };
  }


  private shallowEqual(a: any, b: any) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  digitsOnly(ctrlName: string) {
    const ctrl = this.form.get(ctrlName);
    if (!ctrl) return;
    const before = (ctrl.value ?? '').toString();
    const after = before.replace(/\D+/g, '');
    if (after !== before) ctrl.setValue(after, { emitEvent: false });
  }

  // ===== API del modal =====
  open(data: EditGpsOpenData) {
    this.currentId = data.id;
    this.show = true;

    this.form.reset({
      imei: data.imei ?? '',
      sn: data.sn ?? '',
      name: data.name ?? '',
      brand: data.brand ?? '',
      model: data.model ?? '',
      status: (data.status as DeviceStatus) ?? 'En inventario',
      purchaseDate: this.toDate(data.purchaseDate),
      entryDate: this.toDate(data.entryDate),
      installationDate: this.toDate(data.installationDate ?? null),
      client: data.client ?? '',
      comments: data.comments ?? '',
    });

    this.initialSnapshot = this.snapshotForm();
    this.hasChanges = false;

    this.changesSub?.unsubscribe();
    this.changesSub = this.form.valueChanges.subscribe(() => {
      const current = this.snapshotForm();
      this.hasChanges = !this.shallowEqual(current, this.initialSnapshot);
    });
  }

  close() {
    this.show = false;
    this.changesSub?.unsubscribe();
  }

  submit() {
    if (this.form.invalid || !this.currentId) return;
    this.loading = true;

    // snapshot actual (normalizado) y payload (con formato API)
    const v = this.form.value;
    const current: Record<GpsEditableKeys, any> = this.snapshotForm();

    const fullPayload: Record<GpsEditableKeys, any> = {
      imei: String(v.imei ?? '').trim(),
      sn: String(v.sn ?? '').trim(),
      name: String(v.name ?? '').trim(),
      brand: String(v.brand ?? '').trim(),
      model: String(v.model ?? '').trim(),
      status: v.status as DeviceStatus,
      purchaseDate: this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),
      installationDate: v.installationDate ? this.toYMD(v.installationDate) : null,
      client: this.emptyToNull(v.client),
      comments: this.emptyToNull(v.comments),
    };

    // Enviar solo campos cambiados (opcional, eficiente)
    const keys = Object.keys(current) as GpsEditableKeys[];
    const changedOnly: Partial<Record<GpsEditableKeys, any>> = {};

    for (const k of keys) {
      if (!this.initialSnapshot || current[k] !== this.initialSnapshot[k]) {
        changedOnly[k] = fullPayload[k];
      }
    }

    this.gpsUpdated.emit({
      id: this.currentId,
      payload: Object.keys(changedOnly).length ? changedOnly : fullPayload, // fallback por si acaso
    });

    this.loading = false;
    this.close();
  }
}
