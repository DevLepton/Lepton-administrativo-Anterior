// new-sim-modal.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

type DeviceStatus = 'En inventario' | 'En configuración' | 'Instalado';

@Component({
  selector: 'app-new-sim-modal',
  templateUrl: './new-sim-modal.component.html',
  styleUrl: './new-sim-modal.component.scss'
})
export class NewSimModalComponent {
  @Input() modelOptions: string[] = []; // ← llega desde el padre
  @Input() companyOptions: string[] = [];

  @Output() simCreated = new EventEmitter<{
    type: 'sim';
    iccid: string;
    model: string;
    company: string;
    status: DeviceStatus;
    purchaseDate: string;
    entryDate: string;
    installationDate?: string | null;
    client?: string | null;
    comments?: string | null;
  }>();

  show = false;
  form!: FormGroup;
  loading = false;

  // opciones filtradas para el autocomplete
  filteredModels$!: Observable<string[]>;
  filteredCompanies$!: Observable<string[]>;

  constructor(private fb: FormBuilder) {
    const today = new Date();
    this.form = this.fb.group({
      iccid: ['', [Validators.required, Validators.minLength(20)]],
      model: ['', Validators.required],
      company: ['', Validators.required],
      status: ['En inventario', Validators.required],
      purchaseDate: [today, Validators.required],
      entryDate: [today, Validators.required],
      installationDate: [null],
      client: [''],
      comments: [''],
    });

    // stream para filtrar conforme escribe
    this.filteredModels$ = this.form.get('model')!.valueChanges.pipe(
    startWith(''),
    map(v => this.filterList((v ?? '').toString(), this.modelOptions))
  );
    this.filteredCompanies$ = this.form.get('company')!.valueChanges.pipe(
    startWith(''),
    map(v => this.filterList((v ?? '').toString(), this.companyOptions))
  );
  }

  private filterList(value: string, source: string[] = []): string[] {
  const v = value.toLowerCase().trim();
  if (!v) return source ?? [];
  return (source ?? []).filter(opt => opt.toLowerCase().includes(v));
}

  open() {
    this.show = true;
    const today = new Date();
    this.form.reset({
      iccid: '',
      model: '',
      company: '',
      status: 'En inventario',
      purchaseDate: today,
      entryDate: today,
      installationDate: null,
      client: '',
      comments: '',
    });
  }

  close() { this.show = false; }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const v = this.form.value;
    this.simCreated.emit({
      type: 'sim',
      iccid: String(v.iccid).trim(),
      model: String(v.model).trim(),
      company: String(v.company).trim(),
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
}
