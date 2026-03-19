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

  /** Emite un solo GPS (pestaña Individual) */
  @Output() gpsCreated = new EventEmitter<{
    type: 'gps';
    imei: string;
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: DeviceStatus;
    purchaseDate: string | null;     // 'YYYY-MM-DD'
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
    purchaseDate: string | null;     // 'YYYY-MM-DD'
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
      purchaseExternal: [false],
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
      purchaseExternal: [false],
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

    this.form.get('purchaseExternal')!.valueChanges.subscribe(isExternal => {
      this.applyPurchaseExternal(this.form, !!isExternal);
    });

    this.bulkForm.get('purchaseExternal')!.valueChanges.subscribe(isExternal => {
      this.applyPurchaseExternal(this.bulkForm, !!isExternal);
    });

  }

  // ===== Helpers de lista/autocomplete =====
  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  private applyPurchaseExternal(group: FormGroup, isExternal: boolean) {
    const purchaseCtrl = group.get('purchaseDate');
    if (!purchaseCtrl) return;

    if (isExternal) {
      // al deshabilitar, Angular lo excluye de validación => el form puede guardar
      purchaseCtrl.setValue(null, { emitEvent: false });
      purchaseCtrl.disable({ emitEvent: false });
    } else {
      purchaseCtrl.enable({ emitEvent: false });

      // si estaba en null, le ponemos hoy para que el datepicker no quede vacío
      if (!purchaseCtrl.value) {
        purchaseCtrl.setValue(new Date(), { emitEvent: false });
      }
    }
  }


  // ===== Apertura / reset =====
  open() {
    this.show = true;
    this.lockBodyScroll();
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
      purchaseExternal: false,
      purchaseDate: today,
      entryDate: today,
      installationDate: null,
      client: '',
      comments: '',
    });

    this.applyPurchaseExternal(this.form, false);

    // Masivo
    this.bulkForm.reset({
      quantity: 1,
      name: '',
      brand: '',
      model: '',
      status: 'En inventario',
      purchaseExternal: false,
      purchaseDate: today,
      entryDate: today,
      comments: '',
    });

    this.applyPurchaseExternal(this.bulkForm, false);

    // deja un IMEI y un SN
    this.imeis.clear(); this.imeis.push(this.buildImeiCtrl());
    this.sns.clear(); this.sns.push(this.buildSnCtrl());
  }

  close() { this.show = false; this.unlockBodyScroll(); }

  // ====== INDIVIDUAL ======
  submit() {
    if (this.form.invalid) return;
    this.loading = true;

    const isExternal = !!this.form.get('purchaseExternal')!.value;

    this.gpsCreated.emit({
      type: 'gps',
      imei: String(this.form.get('imei')!.value).trim(),
      sn: String(this.form.get('sn')!.value).trim(),
      name: String(this.form.get('name')!.value).trim(),
      brand: String(this.form.get('brand')!.value).trim(),
      model: String(this.form.get('model')!.value).trim(),
      status: this.form.get('status')!.value as DeviceStatus,

      purchaseDate: isExternal ? null : this.toYMD(this.form.get('purchaseDate')!.value),
      entryDate: this.toYMD(this.form.get('entryDate')!.value),

      installationDate: this.form.get('installationDate')!.value
        ? this.toYMD(this.form.get('installationDate')!.value)
        : null,
      client: this.emptyToNull(this.form.get('client')!.value),
      comments: this.emptyToNull(this.form.get('comments')!.value),
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

    const isExternal = !!this.bulkForm.get('purchaseExternal')!.value;

    const common = {
      name: String(this.bulkForm.get('name')!.value).trim(),
      brand: String(this.bulkForm.get('brand')!.value).trim(),
      model: String(this.bulkForm.get('model')!.value).trim(),
      status: this.bulkForm.get('status')!.value as DeviceStatus,
      purchaseDate: isExternal ? null : this.toYMD(this.bulkForm.get('purchaseDate')!.value),
      entryDate: this.toYMD(this.bulkForm.get('entryDate')!.value),
      comments: this.emptyToNull(this.bulkForm.get('comments')!.value),
    };

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
    if (!d) return ''; // o lanza error si prefieres
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
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
