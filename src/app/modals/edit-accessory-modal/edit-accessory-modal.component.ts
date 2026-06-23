import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { AccessoryPayload, DeviceStatus } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type AccessoryEditableKeys =
  | 'accId' | 'sn' | 'supplier' | 'brand' | 'model' | 'status' | 'configured'
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
    ids: string[];
    payload: Partial<Omit<AccessoryPayload, 'type'>>;
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

  constructor(private authService: AuthService, private fb: FormBuilder) {
    this.form = this.fb.group({
      accId: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(80)]],
      sn: ['', [Validators.minLength(3), Validators.maxLength(50)]],
      supplier: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      status: ['En inventario', Validators.required],
      configured: ['null'],
      purchaseExternal: [false],
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

    this.form.get('purchaseExternal')!.valueChanges.subscribe(isExternal => {
      this.applyPurchaseExternal(this.form, !!isExternal);
    });

    const role = this.authService.getUserRole();

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
      supplier: t(v.supplier),
      brand: t(v.brand),
      model: t(v.model),
      status: t(v.status),
      configured: v.configured,
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

  private applyPurchaseExternal(group: FormGroup, isExternal: boolean) {
    const purchaseCtrl = group.get('purchaseDate');
    if (!purchaseCtrl) return;

    if (isExternal) {
      purchaseCtrl.setValue(null, { emitEvent: false });
      purchaseCtrl.disable({ emitEvent: false });

    } else {
      purchaseCtrl.enable({ emitEvent: false });

      if (!purchaseCtrl.value) {
        purchaseCtrl.setValue(new Date(), { emitEvent: false });
      }
    }
  }

  isBulkEdit = false;
  bulkIds: string[] = [];

  // ===== API del modal =====
  open(data: AccessoryPayload | AccessoryPayload[]) {
    const list = Array.isArray(data) ? data : [data];

    this.isBulkEdit = list.length > 1;
    this.bulkIds = list.map(x => x.id!).filter(Boolean);

    const first = list[0];

    this.currentId = first.id || null;
    this.show = true;
    this.lockBodyScroll();

    const isExternal = !first.purchaseDate;

    this.form.reset({
      accId: first.idAccesorio ?? '',
      sn: first.sn ?? '',
      supplier: first.supplier ?? '',
      brand: first.brand ?? '',
      model: first.model ?? '',
      status: (first.status as DeviceStatus) ?? 'En inventario',
      configured: first.configured === true ? 'true' : first.configured === false ? 'false' : 'null',
      purchaseExternal: isExternal,
      purchaseDate: this.toDate(first.purchaseDate),
      entryDate: this.toDate(first.entryDate),
      installationDate: this.toDate(first.installationDate ?? null),
      client: first.client ?? '',
      comments: first.comments ?? '',
    });

    if (this.isBulkEdit) {
      this.form.get('accId')?.disable({ emitEvent: false });
    } else {
      this.form.get('accId')?.enable({ emitEvent: false });
    }

    this.applyPurchaseExternal(this.form, isExternal);
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

    const isExternal = !!this.form.get('purchaseExternal')!.value;

    // payload completo (normalizado)
    const fullPayload: Record<AccessoryEditableKeys, any> = {
      accId: String(v.accId ?? '').trim(),
      sn: String(v.sn ?? '').trim(),
      supplier: String(v.supplier ?? '').trim(),
      brand: String(v.brand ?? '').trim(),
      model: String(v.model ?? '').trim(),
      status: v.status as DeviceStatus,
      configured: v.configured === 'true' ? true : v.configured === 'false' ? false : null,
      purchaseDate: isExternal ? null : this.toYMD(v.purchaseDate),
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

    if (this.isBulkEdit) {
      delete out.accId;
      delete out.id;
    }

    if ('accId' in out) { out.id = out.accId; delete out.accId; }

    this.accessoryUpdated.emit({
      ids: this.isBulkEdit
        ? this.bulkIds
        : [this.currentId!],
      payload: out,
    });

    this.loading = false;
    this.close();
  }
}
