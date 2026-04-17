import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { map, Observable, startWith } from 'rxjs';
import { DeviceStatus } from '../../services/api.service';

@Component({
  selector: 'app-new-accessory-modal',
  templateUrl: './new-accessory-modal.component.html',
  styleUrl: './new-accessory-modal.component.scss'
})

export class NewAccessoryModalComponent {
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

  /** Emite un solo Accesorio (pestaña Individual) */
  @Output() accessoryCreated = new EventEmitter<{
    type: 'accessory';
    id: string;                 // 👈 campo "id" del accesorio (schema)
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: DeviceStatus;
    purchaseDate: string | null;       // 'YYYY-MM-DD'
    entryDate: string;          // 'YYYY-MM-DD'
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>();

  /** Emite muchos Accesorios (pestaña Masivo) */
  @Output() accessoriesBulkCreated = new EventEmitter<Array<{
    type: 'accessory';
    id: string;                 // 👈 campo "id" del accesorio
    sn: string;
    name: string;
    brand: string;
    model: string;
    status: DeviceStatus;
    purchaseDate: string | null;       // 'YYYY-MM-DD'
    entryDate: string;          // 'YYYY-MM-DD'
    installationDate?: string | null; // (en masivo lo dejamos null)
    client?: string | null;           // (en masivo lo dejamos null)
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
      id: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
      sn: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
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
      ids: this.fb.array([this.buildIdCtrl()]),
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
      id: '',
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

    // deja un ID y un SN
    this.ids.clear(); this.ids.push(this.buildIdCtrl());
    this.sns.clear(); this.sns.push(this.buildSnCtrl());
  }

  close() { this.show = false; this.unlockBodyScroll(); }

  // ====== INDIVIDUAL ======
  submit() {
    if (this.form.invalid) return;
    this.loading = true;

    const v = this.form.value;
    const isExternal = !!this.form.get('purchaseExternal')!.value;

    this.accessoryCreated.emit({
      type: 'accessory',
      id: String(v.id).trim(),
      sn: String(v.sn).trim(),
      name: String(v.name).trim(),
      brand: String(v.brand).trim(),
      model: String(v.model).trim(),
      status: v.status as DeviceStatus,

      purchaseDate: isExternal ? null : this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),

      installationDate: v.installationDate ? this.toYMD(v.installationDate) : null,
      client: this.emptyToNull(v.client),
      comments: this.emptyToNull(v.comments),
    });

    this.loading = false;
    this.close();
  }


  // ====== MASIVO ======
  get ids(): FormArray<FormControl<string>> {
    return this.bulkForm.get('ids') as FormArray<FormControl<string>>;
  }
  get sns(): FormArray<FormControl<string>> {
    return this.bulkForm.get('sns') as FormArray<FormControl<string>>;
  }

  private buildIdCtrl(): FormControl<string> {
    return new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(60)]
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

    // IDs
    const ci = this.ids.length;
    if (q > ci) for (let i = ci; i < q; i++) this.ids.push(this.buildIdCtrl());
    else if (q < ci) for (let i = ci - 1; i >= q; i--) this.ids.removeAt(i);

    // SNs
    const cs = this.sns.length;
    if (q > cs) for (let i = cs; i < q; i++) this.sns.push(this.buildSnCtrl());
    else if (q < cs) for (let i = cs - 1; i >= q; i--) this.sns.removeAt(i);
  }

  submitBulk() {
    if (this.bulkForm.invalid || this.ids.length === 0 || this.sns.length === 0) return;

    const v = this.bulkForm.value;
    const isExternal = !!this.bulkForm.get('purchaseExternal')!.value;

    const common = {
      name: String(v.name).trim(),
      brand: String(v.brand).trim(),
      model: String(v.model).trim(),
      status: v.status as DeviceStatus,

      purchaseDate: isExternal ? null : this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),

      comments: this.emptyToNull(v.comments),
      installationDate: null as null,
      client: null as null,
    };

    const n = Math.min(this.ids.length, this.sns.length);
    const payloads = Array.from({ length: n }, (_, i) => ({
      type: 'accessory' as const,
      id: String(this.ids.at(i).value).trim(),
      sn: String(this.sns.at(i).value).trim(),
      ...common
    }));

    this.loading = true;
    this.accessoriesBulkCreated.emit(payloads);
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
}
