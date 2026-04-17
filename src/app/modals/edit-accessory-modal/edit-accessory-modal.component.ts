import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { DeviceStatus } from '../../services/api.service';

export interface EditAccessoryOpenData {
  id: string;                        // _id de Mongo (para update endpoint)
  accId: string;                     // device.id (id del accesorio en schema)
  sn: string;                        // requerido y único
  name: string;                      // device.name
  brand: string;                     // device.brand
  model: string;                     // device.model
  status: DeviceStatus;              // device.status
  purchaseDate: string | Date | null;// device.purchaseDate
  entryDate: string | Date | null;   // device.entryDate
  installationDate?: string | Date | null;
  client?: string | null;
  comments?: string | null;
}

type AccessoryEditableKeys =
  | 'accId' | 'sn' | 'name' | 'brand' | 'model' | 'status'
  | 'purchaseDate' | 'entryDate' | 'installationDate'
  | 'client' | 'comments';

@Component({
  selector: 'app-edit-accessory-modal',
  templateUrl: './edit-accessory-modal.component.html',
  styleUrl: './edit-accessory-modal.component.scss'
})
export class EditAccessoryModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @Input() modelOptions: string[] = [];
  @Input() brandOptions: string[] = [];

  @Output() accessoryUpdated = new EventEmitter<{
    id: string; // _id mongo
    payload: Partial<{
      id: string;                 // 👈 OJO: backend espera "id" (no accId)
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

  isSupportUser = false;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      accId: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(80)]],
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

    const role = (localStorage.getItem('user_role') || '').toLowerCase();

    this.isSupportUser = role === 'soporte';
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
    // fecha local a partir del Y-M-D UTC (evita “un día menos”)
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

  private snapshotForm(): Record<AccessoryEditableKeys, any> {
    const v = this.form.getRawValue();
    const toKey = (x: any) => (x ? this.toYMD(x) : null);
    const t = (s: any) => (s ?? '').toString().trim();

    return {
      accId: t(v.accId),
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

  // ===== API del modal =====
  open(data: EditAccessoryOpenData) {
    this.currentId = data.id;
    this.show = true;
    this.lockBodyScroll();

    this.form.reset({
      accId: data.accId ?? '',
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
    this.unlockBodyScroll();
    this.changesSub?.unsubscribe();
  }

  submit() {
    if (this.form.invalid || !this.currentId) return;
    this.loading = true;

    const v = this.form.value;
    const current: Record<AccessoryEditableKeys, any> = this.snapshotForm();

    // payload completo (normalizado)
    const fullPayload: Record<AccessoryEditableKeys, any> = {
      accId: String(v.accId ?? '').trim(),
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

    // solo cambios
    const keys = Object.keys(current) as AccessoryEditableKeys[];
    const changedOnly: Partial<Record<AccessoryEditableKeys, any>> = {};
    for (const k of keys) {
      if (!this.initialSnapshot || current[k] !== this.initialSnapshot[k]) {
        changedOnly[k] = fullPayload[k];
      }
    }

    // 🔁 traducir accId -> id (backend)
    const out: any = { ...(Object.keys(changedOnly).length ? changedOnly : fullPayload) };
    if ('accId' in out) { out.id = out.accId; delete out.accId; }

    this.accessoryUpdated.emit({
      id: this.currentId,
      payload: out,
    });

    this.loading = false;
    this.close();
  }
}
