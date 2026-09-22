import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { NgToastService } from 'ng-angular-popup';
import { navbarData, NavItem } from '../../sidenav/nav-data';
import { ConfirmModalService } from '../../services/confirm-modal/confirm-modal-service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

interface LabelItem {
  _id: string;
  name: string;
  color: string;
}

interface SectionVersion {
  name: string;
  route: string;
  version: string;
  type: 'Sistema' | 'Sección' | 'Subsección';
}

const SYSTEM_VERSION = '3.0.1';

@Component({
  selector: 'app-system-settings',
  templateUrl: './system-settings.component.html',
  styleUrl: './system-settings.component.scss'
})
export class SystemSettingsComponent {
  readonly systemVersion = SYSTEM_VERSION;

  labels: LabelItem[] = [];
  filteredLabels: LabelItem[] = [];
  labelSearch = '';
  selectedLabelIds = new Set<string>();
  labelsLoading = false;
  labelSaving = false;
  labelDeleting = false;
  labelModalOpen = false;
  labelModalMode: 'create' | 'edit' = 'create';
  editingLabelId: string | null = null;
  labelName = '';
  labelColor = '#0d00ff';
  originalLabelName = '';
  originalLabelColor = '';

  form: FormGroup;

  readonly sectionVersionMap: Record<string, string> = {
    '/configuracion': '1.1.0',
    '/perfil': '1.0.0',
    '/usuarios': '1.0.0',
    '/peticiones': '1.3.2',
    '/clientes': '9.3.1',
    '/inventario': '1.5.1',
    '/clientes-cobranza': '1.2.0',
    '/cotizaciones': '1.1.0',
    '/cotizaciones/productos': '1.2.0',
    '/cotizaciones/foraneos': '1.1.0',
    '/cotizaciones/sugerencias': '1.0.0',
    '/eventos': '1.0.1'
  };

  readonly sectionVersions: SectionVersion[] = [
    {
      name: 'Configuración',
      route: '/configuracion',
      version: this.getSectionVersion('/configuracion'),
      type: 'Sistema'
    },
    {
      name: 'Perfil',
      route: '/perfil',
      version: this.getSectionVersion('/perfil'),
      type: 'Sistema'
    },
    ...this.getNavbarSections(navbarData)
  ];

  constructor(private router: Router, private api: ApiService, private toast: NgToastService, private confirmModal: ConfirmModalService, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      color: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadLabels();
  }

  loadLabels(forceRefresh = false): void {
    if (this.labelsLoading) return;

    this.labelsLoading = true;

    this.api.getLabels(forceRefresh).pipe(
      finalize(() => this.labelsLoading = false)
    ).subscribe({
      next: labels => {
        this.labels = labels.reverse();
        this.updateFilteredLabels();
        this.selectedLabelIds.clear();
      },
      error: error => {
        console.error('Error al cargar etiquetas:', error);
        this.toast.error({
          detail: 'Error',
          summary: error?.error?.error || 'No se pudieron cargar las etiquetas',
          duration: 5000
        });
      }
    });
  }

  reloadLabels(): void {
    this.loadLabels(true);
  }

  updateLabelSearch(value: string): void {
    this.labelSearch = (value ?? '').trim();
    this.updateFilteredLabels();
  }

  private updateFilteredLabels(): void {
    const q = this.normalize(this.labelSearch);
    this.filteredLabels = this.labels.filter(label => !q || this.normalize(label.name).includes(q) || this.normalize(label.color).includes(q));
  }

  isLabelSelected(id: string): boolean { return this.selectedLabelIds.has(id); }

  get allLabelsSelected(): boolean { return this.filteredLabels.length > 0 && this.filteredLabels.every(label => this.selectedLabelIds.has(label._id)); }

  get someLabelsSelected(): boolean { return this.filteredLabels.some(label => this.selectedLabelIds.has(label._id)) && !this.allLabelsSelected; }

  get selectedLabelCount(): number { return this.selectedLabelIds.size; }

  toggleLabelSelection(id: string, checked: boolean): void {
    if (checked) this.selectedLabelIds.add(id);
    else this.selectedLabelIds.delete(id);
  }

  toggleAllLabels(checked: boolean): void {
    if (checked) this.filteredLabels.forEach(label => this.selectedLabelIds.add(label._id));
    else this.filteredLabels.forEach(label => this.selectedLabelIds.delete(label._id));
  }

  openCreateLabelModal(): void {
    this.labelModalMode = 'create';
    this.editingLabelId = null;
    this.originalLabelName = '';
    this.originalLabelColor = '';
    this.form.reset({ name: '', color: this.generateRandomLabelColor() });
    this.labelModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  openEditLabelModal(label: LabelItem): void {
    this.labelModalMode = 'edit';
    this.editingLabelId = label._id;
    this.originalLabelName = label.name;
    this.originalLabelColor = label.color;
    this.form.setValue({ name: label.name, color: label.color });
    this.labelModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLabelModal(): void {
    this.labelModalOpen = false;
    this.labelSaving = false;
    this.editingLabelId = null;
    document.body.style.overflow = '';
  }

  saveLabel(): void {
    const nameControl = this.form.get('name');
    const colorControl = this.form.get('color');

    const name = (nameControl?.value ?? '').trim();
    const color = (colorControl?.value ?? '').trim();

    nameControl?.setValue(name, { emitEvent: false });
    colorControl?.setValue(color, { emitEvent: false });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const duplicate = this.labels.some(label => this.normalize(label.name) === this.normalize(name) && label._id !== this.editingLabelId);

    if (duplicate) {
      nameControl?.setErrors({ ...nameControl.errors, duplicate: true });
      nameControl?.markAsTouched();
      return;
    }

    if (!/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color)) {
      this.toast.warning({ detail: 'Color inválido', summary: 'El color debe ser hexadecimal', duration: 4000 });
      return;
    }

    this.labelSaving = true;
    const payload = { name, color };
    const request$ = this.labelModalMode === 'create' ? this.api.createLabel([payload]) : this.api.updateLabel(this.editingLabelId!, payload);

    request$.subscribe({
      next: () => {
        this.toast.success({ detail: 'Éxito', summary: this.labelModalMode === 'create' ? 'Etiqueta creada' : 'Etiqueta actualizada', duration: 3500 });
        this.closeLabelModal();
        this.loadLabels();
      },
      error: error => {
        console.error(error);
        this.toast.error({ detail: 'Error', summary: error?.error?.error || error?.error?.message || 'No se pudo guardar la etiqueta', duration: 5000 });
        this.labelSaving = false;
      }
    });
  }

  async deleteSelectedLabels(): Promise<void> {
    const ids = Array.from(this.selectedLabelIds);
    if (!ids.length || this.labelDeleting) return;

    const confirmed = await this.confirmModal.open({
      title: 'Eliminar etiquetas',
      message: `¿Estás seguro de que deseas eliminar ${ids.length === 1 ? 'la etiqueta seleccionada' : `las ${ids.length} etiquetas seleccionadas`}?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    this.labelDeleting = true;

    this.api.deleteLabels(ids).subscribe({
      next: response => {
        this.toast.success({
          detail: 'Éxito',
          summary: response?.message || 'Etiquetas eliminadas correctamente',
          duration: 4000
        });

        this.selectedLabelIds.clear();
        this.loadLabels();
      },
      error: error => {
        console.error(error);
        this.toast.error({
          detail: 'Error',
          summary: error?.error?.error || 'No se pudieron eliminar las etiquetas',
          duration: 5000
        });
      },
      complete: () => this.labelDeleting = false
    });
  }

  private normalize(value: unknown): string { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

    const toHex = (value: number) => Math.round(255 * value).toString(16).padStart(2, '0');

    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  private generateRandomLabelColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 65 + Math.floor(Math.random() * 21);
    const lightness = 40 + Math.floor(Math.random() * 21);

    return this.hslToHex(hue, saturation, lightness);
  }

  get labelNameDuplicate(): boolean {
    const name = this.normalize(this.form.get('name')?.value?.trim() ?? '');
    if (!name) return false;
    return this.labels.some(label => this.normalize(label.name) === name && label._id !== this.editingLabelId);
  }

  get labelNameInvalid(): boolean {
    return !this.labelName.trim() || this.labelNameDuplicate;
  }

  get labelHasChanges(): boolean {
    const name = (this.form.get('name')?.value ?? '').trim();
    const color = (this.form.get('color')?.value ?? '').trim().toLowerCase();

    return name !== this.originalLabelName.trim() || color !== this.originalLabelColor.trim().toLowerCase();
  }

  closeSettings(): void {
    this.router.navigate(['/'], { replaceUrl: true });
  }

  private getNavbarSections(items: NavItem[], parentName?: string): SectionVersion[] {
    return items.flatMap((item) => {
      const route = `/${item.RouteLink}`;
      const currentSection: SectionVersion = {
        name: parentName ? `${parentName} / ${item.label}` : item.label,
        route,
        version: this.getSectionVersion(route),
        type: parentName ? 'Subsección' : 'Sección'
      };

      return [
        currentSection,
        ...this.getNavbarSections(item.children ?? [], item.label)
      ];
    });
  }

  trackByLabelId(_: number, label: LabelItem): string { return label._id; }

  private getSectionVersion(route: string): string {
    return this.sectionVersionMap[route] ?? SYSTEM_VERSION;
  }
}
