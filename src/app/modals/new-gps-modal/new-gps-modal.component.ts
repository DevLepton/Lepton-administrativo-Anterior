import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith } from 'rxjs';

export type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado';

@Component({
  selector: 'app-new-gps-modal',
  templateUrl: './new-gps-modal.component.html',
  styleUrl: './new-gps-modal.component.scss'
})
export class NewGpsModalComponent {
  @Input() modelOptions: string[] = [];
  @Input() brandOptions: string[] = [];

  /** Emite un solo GPS (pestaña Individual) */
  @Output() gpsCreated = new EventEmitter<{
    type: 'gps';
    imei: string;
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: DeviceStatus;
    purchaseDate: string;     // 'YYYY-MM-DD'
    entryDate: string;        // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>();

  /** Emite muchos GPS (pestaña Masivo) */
  @Output() gpsBulkCreated = new EventEmitter<Array<{
    type: 'gps';
    imei: string;
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: DeviceStatus;
    purchaseDate: string;     // 'YYYY-MM-DD'
    entryDate: string;        // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>>();

  show = false;
  loading = false;
  activeTab = 0;

  // ---- Form individual ----
  form!: FormGroup;
  filteredModels$!: Observable<string[]>;
  filteredBrands$!: Observable<string[]>;

  // ---- Form masivo ----
  bulkForm!: FormGroup;
  filteredModelsBulk$!: Observable<string[]>;
  filteredBrandsBulk$!: Observable<string[]>;

  constructor(private fb: FormBuilder) {
    const today = new Date();

    // ====== INDIVIDUAL ======
    this.form = this.fb.group({
      imei: ['', [
        Validators.required,
        Validators.pattern(/^\d+$/),
        Validators.minLength(14),
        Validators.maxLength(20)
      ]],
      sn: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50)
      ]],
      name: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      status: ['En inventario', Validators.required],
      purchaseDate: [today, Validators.required],
      entryDate: [today, Validators.required],
      installationDate: [null],
      client: [''],
      comments: [''],
    });

    // ====== MASIVO ======
    this.bulkForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(200)]],
      name: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      status: ['En inventario', Validators.required],
      purchaseDate: [today, Validators.required],
      entryDate: [today, Validators.required],
      comments: [''],
      imeis: this.fb.array([this.buildImeiCtrl()]),
      sns: this.fb.array([this.buildSnCtrl()]),
    });

    // Autocomplete streams
    this.filteredModels$ = this.form.get('model')!.valueChanges.pipe(
      startWith(''), map(v => this.filterList((v ?? '').toString(), this.modelOptions))
    );
    this.filteredBrands$ = this.form.get('brand')!.valueChanges.pipe(
      startWith(''), map(v => this.filterList((v ?? '').toString(), this.brandOptions))
    );

    this.filteredModelsBulk$ = this.bulkForm.get('model')!.valueChanges.pipe(
      startWith(''), map(v => this.filterList((v ?? '').toString(), this.modelOptions))
    );
    this.filteredBrandsBulk$ = this.bulkForm.get('brand')!.valueChanges.pipe(
      startWith(''), map(v => this.filterList((v ?? '').toString(), this.brandOptions))
    );
  }

  // ===== Helpers de lista/autocomplete =====
  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  // ===== Apertura / reset =====
  open() {
    this.show = true;
    this.activeTab = 0;

    const today = new Date();

    // Individual
    this.form.reset({
      imei: '',
      sn: '',
      name: '',
      brand: '',
      model: '',
      status: 'En inventario',
      purchaseDate: today,
      entryDate: today,
      installationDate: null,
      client: '',
      comments: '',
    });

    // Masivo
    this.bulkForm.reset({
      quantity: 1,
      name: '',
      brand: '',
      model: '',
      status: 'En inventario',
      purchaseDate: today,
      entryDate: today,
      comments: '',
    });

    // deja un IMEI y un SN
    this.imeis.clear(); this.imeis.push(this.buildImeiCtrl());
    this.sns.clear(); this.sns.push(this.buildSnCtrl());
  }

  close() { this.show = false; }

  // ====== INDIVIDUAL ======
  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const v = this.form.value;

    this.gpsCreated.emit({
      type: 'gps',
      imei: String(v.imei).trim(),
      sn: String(v.sn).trim(),
      name: String(v.name).trim(),
      brand: String(v.brand).trim(),
      model: String(v.model).trim(),
      status: v.status as DeviceStatus,
      purchaseDate: this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),
      installationDate: v.installationDate ? this.toYMD(v.installationDate) : null,
      client: this.emptyToNull(v.client),
      comments: this.emptyToNull(v.comments),
    });

    this.loading = false;
    this.close();
  }

  // ====== MASIVO ======
  get imeis(): FormArray<FormControl<string>> {
    return this.bulkForm.get('imeis') as FormArray<FormControl<string>>;
  }
  get sns(): FormArray<FormControl<string>> {
    return this.bulkForm.get('sns') as FormArray<FormControl<string>>;
  }

  private buildImeiCtrl(): FormControl<string> {
    return new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+$/), Validators.minLength(14), Validators.maxLength(20)]
    });
  }
  private buildSnCtrl(): FormControl<string> {
    return new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(50)]
    });
  }

  incQty() {
    const q = (this.bulkForm.get('quantity')!.value || 1) + 1;
    this.bulkForm.get('quantity')!.setValue(Math.min(q, 200));
    this.syncArraysWithQuantity();
  }
  decQty() {
    const q = (this.bulkForm.get('quantity')!.value || 1) - 1;
    this.bulkForm.get('quantity')!.setValue(Math.max(q, 1));
    this.syncArraysWithQuantity();
  }

  syncArraysWithQuantity() {
    let q = Number(this.bulkForm.get('quantity')!.value || 1);
    if (q < 1) q = 1;
    if (q > 200) q = 200;

    // IMEIs
    const ci = this.imeis.length;
    if (q > ci) for (let i = ci; i < q; i++) this.imeis.push(this.buildImeiCtrl());
    else if (q < ci) for (let i = ci - 1; i >= q; i--) this.imeis.removeAt(i);

    // SNs
    const cs = this.sns.length;
    if (q > cs) for (let i = cs; i < q; i++) this.sns.push(this.buildSnCtrl());
    else if (q < cs) for (let i = cs - 1; i >= q; i--) this.sns.removeAt(i);
  }

  submitBulk() {
    if (this.bulkForm.invalid || this.imeis.length === 0 || this.sns.length === 0) return;

    const v = this.bulkForm.value;
    const common = {
      name: String(v.name).trim(),
      brand: String(v.brand).trim(),
      model: String(v.model).trim(),
      status: v.status as DeviceStatus,
      purchaseDate: this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),
      comments: this.emptyToNull(v.comments),
    };

    // Construimos el array de dispositivos con pares IMEI/SN por índice
    const n = Math.min(this.imeis.length, this.sns.length);
    const payloads = Array.from({ length: n }, (_, i) => ({
      type: 'gps' as const,
      imei: String(this.imeis.at(i).value).trim(),
      sn: String(this.sns.at(i).value).trim(),
      ...common
    }));

    this.loading = true;
    this.gpsBulkCreated.emit(payloads);
    this.loading = false;
    this.close();
  }

  // ===== Utilidades =====
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

  // Limpia no-numérico (para IMEI)
  digitsOnlyCtrl(group: FormGroup, ctrlName: string) {
    const ctrl = group.get(ctrlName);
    if (!ctrl) return;
    const before = (ctrl.value ?? '').toString();
    const after = before.replace(/\D+/g, '');
    if (after !== before) ctrl.setValue(after, { emitEvent: false });
  }
  digitsOnlyFA(arr: FormArray, idx: number) {
    const ctrl = arr.at(idx) as FormControl;
    const before = (ctrl.value ?? '').toString();
    const after = before.replace(/\D+/g, '');
    if (after !== before) ctrl.setValue(after, { emitEvent: false });
  }
}
