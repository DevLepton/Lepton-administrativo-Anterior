import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, CreateRequestPayload, RequestedDeviceItem } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';
import { map, Observable, startWith } from 'rxjs';

type ReqItem = { model: string; quantity: number };

@Component({
  selector: 'app-new-request-modal',
  templateUrl: './new-request-modal.component.html',
  styleUrl: './new-request-modal.component.scss'
})
export class NewRequestModalComponent {
  private lockBodyScroll() { document.body.style.overflow = 'hidden'; }
  private unlockBodyScroll() { document.body.style.overflow = ''; }
  ngOnDestroy() { this.unlockBodyScroll(); }

  @Output() requestCreated = new EventEmitter<any>();

  show = false;
  loading = false;

  form!: FormGroup;

  deviceModelOptions: string[] = [];
  filteredDeviceModels$!: Observable<string[]>;

  // ✅ lista final
  items: ReqItem[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private toast: NgToastService,
  ) {
    this.form = this.fb.group({
      deviceRequested: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
      comments: ['']
    });

    this.filteredDeviceModels$ = this.form.get('deviceRequested')!.valueChanges.pipe(
      startWith(''),
      map(v => this.filterList((v ?? '').toString(), this.deviceModelOptions))
    );
  }

  private filterList(value: string, source: string[] = []): string[] {
    const v = value.toLowerCase().trim();
    if (!v) return source ?? [];
    return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
  }

  open() {
    this.show = true;
    this.lockBodyScroll();
    this.loading = false;

    this.items = [];
    this.form.reset({ deviceRequested: '', quantity: 1, comments: '' });

    this.loadDeviceModels();
  }

  close() {
    this.show = false;
    this.unlockBodyScroll();
  }

  private loadDeviceModels() {
    this.apiService.getDevices().subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

        const models: string[] = list
          .map((d: any): string => (d?.model ?? '').toString().trim())
          .filter((m: string): m is string => m.length > 0);

        this.deviceModelOptions = Array.from(new Set<string>(models)).sort((a, b) => a.localeCompare(b));
        const current = this.form.get('deviceRequested')!.value ?? '';
        this.form.get('deviceRequested')!.setValue(current, { emitEvent: true });
      },
      error: (err) => {
        console.error(err);
        this.toast.error({ detail: 'Error', summary: 'No se pudieron cargar los modelos', duration: 4500 });
      }
    });
  }

  // ===== total =====
  get totalRequested(): number {
    return this.items.reduce((s, x) => s + x.quantity, 0);
  }

  // ===== controls qty input =====
  incQty() {
    const q = (Number(this.form.get('quantity')!.value) || 1) + 1;
    // limite por input: 50, pero también no dejar pasar el total 50 al agregar
    this.form.get('quantity')!.setValue(Math.min(q, 50));
  }

  decQty() {
    const q = (Number(this.form.get('quantity')!.value) || 1) - 1;
    this.form.get('quantity')!.setValue(Math.max(q, 1));
  }

  clampQty() {
    let q = Number(this.form.get('quantity')!.value || 1);
    if (Number.isNaN(q)) q = 1;
    q = Math.max(1, Math.min(50, q));
    this.form.get('quantity')!.setValue(q, { emitEvent: false });
  }

  get canAdd(): boolean {
    const model = String(this.form.get('deviceRequested')!.value ?? '').trim();
    const qty = Number(this.form.get('quantity')!.value ?? 1);
    if (!model) return false;
    if (!Number.isFinite(qty) || qty < 1) return false;
    if (this.totalRequested >= 50) return false;
    return true;
  }

  get showDeviceError(): boolean {
    const c = this.form.get('deviceRequested');
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  addToList() {
    const model = String(this.form.get('deviceRequested')!.value ?? '').trim();
    const qty = Number(this.form.get('quantity')!.value ?? 1);

    if (!model) return;

    // no permitir exceder 50 total
    const allowed = 50 - this.totalRequested;
    if (allowed <= 0) {
      this.toast.warning({ detail: 'Aviso', summary: 'Límite alcanzado (50)', duration: 2500 });
      return;
    }

    const addQty = Math.min(qty, allowed);

    const idx = this.items.findIndex(x => x.model.toLowerCase() === model.toLowerCase());
    if (idx >= 0) {
      this.items[idx] = { ...this.items[idx], quantity: this.items[idx].quantity + addQty };
    } else {
      this.items.push({ model, quantity: addQty });
    }

    if (addQty < qty) {
      this.toast.info({ detail: 'Info', summary: `Solo se agregaron ${addQty} por límite total 50`, duration: 3000 });
    }

    // reset inputs
    this.form.patchValue({ deviceRequested: '', quantity: 1 }, { emitEvent: true });

    const deviceCtrl = this.form.get('deviceRequested');
    deviceCtrl?.markAsPristine();
    deviceCtrl?.markAsUntouched();
    deviceCtrl?.updateValueAndValidity({ emitEvent: false });

    const qtyCtrl = this.form.get('quantity');
    qtyCtrl?.markAsPristine();
    qtyCtrl?.markAsUntouched();
    qtyCtrl?.updateValueAndValidity({ emitEvent: false });

  }

  incItem(i: number) {
    if (this.totalRequested >= 50) return;
    this.items[i] = { ...this.items[i], quantity: this.items[i].quantity + 1 };
  }

  decItem(i: number) {
    const q = this.items[i].quantity - 1;
    if (q < 1) return;
    this.items[i] = { ...this.items[i], quantity: q };
  }

  removeItem(i: number) {
    this.items.splice(i, 1);
    this.items = [...this.items];
  }

  submit() {
    if (this.items.length === 0) return;

    const total = this.totalRequested;
    if (total < 1 || total > 50) {
      this.toast.warning({ detail: 'Aviso', summary: 'La cantidad total debe estar entre 1 y 50', duration: 3000 });
      return;
    }

    this.loading = true;

    const devicesRequested: RequestedDeviceItem[] = this.items.map(x => ({
      model: x.model,
      quantity: x.quantity
    }));

    const payload: CreateRequestPayload = {
      status: 'Pendiente',
      requestDate: new Date(),
      responseDate: null,
      devicesRequested,
      quantity: total,
      comments: this.form.get('comments')?.value || '',
    };

    this.apiService.createRequest(payload).subscribe({
      next: (resp: any) => {
        this.toast.success({ detail: 'Éxito', summary: 'Petición creada', duration: 3500 });
        this.requestCreated.emit(resp?.data ?? payload);
        this.loading = false;
        this.close();
      },
      error: (err) => {
        console.error('Error createRequest:', err);
        const msg = err?.error?.error || err?.error?.message || 'No se pudo crear la petición';
        this.toast.error({ detail: 'Error', summary: msg, duration: 6000 });
        this.loading = false;
      }
    });
  }
}
