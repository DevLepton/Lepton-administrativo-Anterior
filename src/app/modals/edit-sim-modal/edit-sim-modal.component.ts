import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceStatus } from '../../services/api.service';
import { SimItem } from '../../inventario/almacen/sims-tab/sims-tab.component';
import { AuthService } from '../../services/auth.service';

type SimEditableKeys =
  | 'iccid'
  | 'model'
  | 'company'
  | 'status'
  | 'supplier'
  | 'usage'
  | 'purchaseDate'
  | 'entryDate'
  | 'installationDate'
  | 'client'
  | 'comments';

@Component({
  selector: 'app-edit-sim-modal',
  templateUrl: './edit-sim-modal.component.html',
  styleUrl: './edit-sim-modal.component.scss'
})
export class EditSimModalComponent {
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
  @Input() companyOptions: string[] = [];

  @Output() simUpdated = new EventEmitter<{
    ids: string[];
    payload: Partial<Omit<SimItem, 'id'>>;
  }>();

  show = false;
  form!: FormGroup;
  loading = false;
  private currentId: string | null = null;

  filteredModels$!: Observable<string[]>;
  filteredCompanies$!: Observable<string[]>;

  hasChanges = false;
  private initialSnapshot: any = null;
  private changesSub?: Subscription;

  isSupportUser = false;

  isBulkEdit = false;
  bulkIds: string[] = [];

  private snapshotForm() {
    const v = this.form.getRawValue();
    const toKey = (d: any) => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return null;
      // normalizamos a Y-M-D para evitar diferencias por hora/zona
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const t = (s: any) => (s ?? '').toString().trim();
    return {
      iccid: t(v.iccid),
      model: t(v.model),
      company: t(v.company),
      status: t(v.status),
      supplier: t(v.supplier),
      usage: t(v.usage),
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
    for (const k of ka) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  }

  constructor(private authService: AuthService, private fb: FormBuilder) {
    this.form = this.fb.group({
      iccid: ['', [
        Validators.required,
        Validators.minLength(19),
        Validators.maxLength(20),
        Validators.pattern(/^\d+$/)
      ]],
      model: ['', Validators.required],
      company: ['', Validators.required],
      supplier: ['', Validators.required],
      status: ['En inventario', Validators.required],
      usage: ['GPS', Validators.required],
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
    this.filteredCompanies$ = this.form.get('company')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.companyOptions))
    );

    const role = this.authService.getUserRole();

    this.isSupportUser = role === 'soporte';
  }

  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  /** Abre el modal con los datos del SIM */
  open(data: SimItem | SimItem[]) {

    const list = Array.isArray(data) ? data : [data];

    this.isBulkEdit = list.length > 1;
    this.bulkIds = list.map(x => x.id);

    const first = list[0];

    this.currentId = first.id;
    this.show = true;
    this.lockBodyScroll();

    this.form.reset({
      iccid: first.iccid ?? '',
      model: first.model ?? '',
      company: first.company ?? '',
      supplier: first.supplier ?? '',
      status: (first.status as DeviceStatus) ?? 'En inventario',
      usage: first.usage ?? 'GPS',
      purchaseDate: this.toDate(first.purchaseDate),
      entryDate: this.toDate(first.entryDate),
      installationDate: this.toDate(first.installationDate ?? null),
      client: first.client ?? '',
      comments: first.comments ?? '',
    });

    if (this.isBulkEdit) {
      this.form.get('iccid')?.disable({ emitEvent: false });
    } else {
      this.form.get('iccid')?.enable({ emitEvent: false });
    }

    // Tomamos la "foto" inicial y marcamos sin cambios
    this.initialSnapshot = this.snapshotForm();
    this.hasChanges = false;

    // Re-suscribir al stream de cambios (limpiando si ya había uno)
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

    const current = this.snapshotForm();

    const fullPayload = {
      type: 'sim' as const,

      iccid: String(v.iccid ?? '').trim(),
      model: String(v.model ?? '').trim(),
      company: String(v.company ?? '').trim(),
      supplier: String(v.supplier ?? '').trim(),

      status: v.status as DeviceStatus,

      usage: v.usage,

      purchaseDate: this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),

      installationDate: v.installationDate
        ? this.toYMD(v.installationDate)
        : null,

      client: this.emptyToNull(v.client),
      comments: this.emptyToNull(v.comments),
    };

    const changedOnly: Partial<Record<SimEditableKeys, any>> = {};

    const keys = Object.keys(current) as SimEditableKeys[];

    for (const k of keys) {

      if (
        !this.initialSnapshot ||
        current[k] !== this.initialSnapshot[k]
      ) {
        changedOnly[k] = (fullPayload as any)[k];
      }
    }

    if (this.isBulkEdit) {
      delete changedOnly.iccid;
    }

    this.simUpdated.emit({
      ids: this.isBulkEdit
        ? this.bulkIds
        : [this.currentId],

      payload: Object.keys(changedOnly).length
        ? changedOnly
        : fullPayload
    });

    this.loading = false;

    this.close();
  }

  // Helpers
  // Reemplaza tu toDate por esta versión "UTC-safe"
  private toDate(d: any): Date | null {
    if (!d) return null;

    // Si ya es Date, úsala tal cual
    if (d instanceof Date) return d;

    // Si viene como ISO '...Z' (UTC), extraemos Y-M-D en UTC
    const iso = new Date(d);
    if (isNaN(iso.getTime())) return null;

    const y = iso.getUTCFullYear();
    const m = iso.getUTCMonth();      // 0-11
    const day = iso.getUTCDate();

    // Creamos un Date local con ese Y-M-D (sin corrimiento por huso)
    return new Date(y, m, day);
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

  digitsOnly(ctrlName: string) {
    const ctrl = this.form.get(ctrlName);
    if (!ctrl) return;
    const before = (ctrl.value ?? '').toString();
    const after = before.replace(/\D+/g, ''); // quita todo lo no numérico
    if (after !== before) ctrl.setValue(after, { emitEvent: false });
  }

}
