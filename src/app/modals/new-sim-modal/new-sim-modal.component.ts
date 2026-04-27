import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DeviceStatus, SimPayload } from '../../services/api.service';

@Component({
  selector: 'app-new-sim-modal',
  templateUrl: './new-sim-modal.component.html',
  styleUrl: './new-sim-modal.component.scss'
})
export class NewSimModalComponent {
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @Input() existingSims: { iccid: string }[] = [];
  @Input() modelOptions: string[] = [];
  @Input() companyOptions: string[] = [];

  /** Emite un solo SIM (pestaña Individual) */
  @Output() simCreated = new EventEmitter<SimPayload>();

  /** Emite muchos SIM (pestaña Masivo) */
  @Output() simsBulkCreated = new EventEmitter<Array<SimPayload>>();

  show = false;
  loading = false;
  activeTab = 0;

  // ---- Form individual ----
  form!: FormGroup;
  filteredModels$!: Observable<string[]>;
  filteredCompanies$!: Observable<string[]>;

  // ---- Form masivo ----
  bulkForm!: FormGroup;
  filteredModelsBulk$!: Observable<string[]>;
  filteredCompaniesBulk$!: Observable<string[]>;

  constructor(private fb: FormBuilder) {
    const today = new Date();

    // Individual
    this.form = this.fb.group({
      iccid: ['', [Validators.required, Validators.minLength(19), Validators.maxLength(20), Validators.pattern(/^\d+$/)]],
      model: ['', Validators.required],
      company: ['', Validators.required],
      status: ['En inventario', Validators.required],
      supplier: ['', Validators.required],
      usage: ['GPS', Validators.required],
      purchaseDate: [today, Validators.required],
      entryDate: [today, Validators.required],
      installationDate: [null],
      client: [''],
      comments: [''],
    });

    // Masivo
    this.bulkForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(200)]],
      model: ['', Validators.required],
      company: ['', Validators.required],
      status: ['En inventario', Validators.required],
      supplier: ['', Validators.required],
      usage: ['GPS', Validators.required],
      purchaseDate: [today, Validators.required],
      entryDate: [today, Validators.required],
      comments: [''],
      iccids: this.fb.array([this.buildIccidCtrl()]),
    });

    this.form.get('iccid')?.addValidators(
      this.duplicateFromExisting(() =>
        this.existingSims.map(s => s.iccid)
      )
    );

    // Autocomplete streams
    this.filteredModels$ = this.form.get('model')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.modelOptions))
    );
    this.filteredCompanies$ = this.form.get('company')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.companyOptions))
    );

    this.filteredModelsBulk$ = this.bulkForm.get('model')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.modelOptions))
    );
    this.filteredCompaniesBulk$ = this.bulkForm.get('company')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.companyOptions))
    );

    this.iccids.valueChanges.subscribe(() => {
      this.iccids.controls.forEach(c =>
        c.updateValueAndValidity({ emitEvent: false })
      );
    });
  }

  ngOnChanges() {
    this.form.get('iccid')?.updateValueAndValidity();
    this.iccids.controls.forEach(c => c.updateValueAndValidity());
  }

  // ===== Helpers de lista/autocomplete =====
  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  private duplicateFromExisting(getList: () => string[]) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value || '').trim();
      if (!value) return null;

      return getList().includes(value) ? { duplicate: true } : null;
    };
  }

  private duplicateInArray(getList: () => string[]) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value || '').trim();
      if (!value) return null;

      const list = getList();
      const count = list.filter(v => v === value).length;

      return count > 1 ? { duplicate: true } : null;
    };
  }

  // ===== Apertura / reset =====
  open() {
    this.show = true;
    this.lockBodyScroll();
    this.activeTab = 0;

    const today = new Date();
    // Individual
    this.form.reset({
      iccid: '',
      model: '',
      company: '',
      status: 'En inventario',
      supplier: '',
      usage: 'GPS',
      purchaseDate: today,
      entryDate: today,
      installationDate: null,
      client: '',
      comments: '',
    });

    // Masivo
    this.bulkForm.reset({
      quantity: 1,
      model: '',
      company: '',
      status: 'En inventario',
      supplier: '',
      usage: 'GPS',
      purchaseDate: today,
      entryDate: today,
      comments: '',
    });
    // deja un campo ICCID
    this.iccids.clear();
    this.iccids.push(this.buildIccidCtrl());
  }

  close() { this.show = false; this.unlockBodyScroll(); }

  // ====== INDIVIDUAL ======
  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const v = this.form.value;
    this.simCreated.emit({
      type: 'sim',
      iccid: String(v.iccid).trim(),
      model: String(v.model).trim(),
      company: String(v.company).trim(),
      supplier: String(v.supplier).trim(),
      status: v.status as DeviceStatus,
      usage: v.usage,
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
  get iccids(): FormArray<FormControl<string>> {
    return this.bulkForm.get('iccids') as FormArray<FormControl<string>>;
  }

  private buildIccidCtrl(): FormControl<string> {
    return new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(19),
        Validators.maxLength(20),
        Validators.pattern(/^\d+$/),

        // 🔥 NUEVO
        this.duplicateInArray(() => this.iccids.controls.map(c => c.value)),
        this.duplicateFromExisting(() => this.existingSims.map(s => s.iccid))
      ]
    });
  }

  incQty() {
    const q = (this.bulkForm.get('quantity')!.value || 1) + 1;
    this.bulkForm.get('quantity')!.setValue(Math.min(q, 200));
    this.syncIccidsWithQuantity();
  }

  decQty() {
    const q = (this.bulkForm.get('quantity')!.value || 1) - 1;
    this.bulkForm.get('quantity')!.setValue(Math.max(q, 1));
    this.syncIccidsWithQuantity();
  }

  syncIccidsWithQuantity() {
    let q = Number(this.bulkForm.get('quantity')!.value || 1);
    if (q < 1) q = 1;
    if (q > 200) q = 200;

    const current = this.iccids.length;
    if (q > current) {
      for (let i = current; i < q; i++) this.iccids.push(this.buildIccidCtrl());
    } else if (q < current) {
      for (let i = current - 1; i >= q; i--) this.iccids.removeAt(i);
    }
  }

  submitBulk() {
    if (this.bulkForm.invalid || this.iccids.length === 0) return;

    const v = this.bulkForm.value;
    const common = {
      model: String(v.model).trim(),
      company: String(v.company).trim(),
      status: v.status as DeviceStatus,
      supplier: String(v.supplier).trim(),
      usage: v.usage,
      purchaseDate: this.toYMD(v.purchaseDate),
      entryDate: this.toYMD(v.entryDate),
      comments: this.emptyToNull(v.comments),
    };

    // Construimos el array de dispositivos
    const payloads = this.iccids.controls.map(ctrl => ({
      type: 'sim' as const,
      iccid: String(ctrl.value).trim(),
      ...common
    }));

    this.loading = true;
    this.simsBulkCreated.emit(payloads);
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
