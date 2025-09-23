import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { NgToastService } from 'ng-angular-popup';
@Component({
  selector: 'app-edit-clientes-modal',
  templateUrl: './edit-clientes-modal.component.html',
  styleUrls: ['./edit-clientes-modal.component.scss'],
})
export class EditClientesModalComponent implements OnInit {
  isVisible = false; // Control de visibilidad del modal
  clienteForm!: FormGroup; // Formulario reactivo
  idCliente: number | null = null; // Almacenar el id del cliente
  emailExistsError: boolean = false; // Indica si el correo ya está registrado
  colonias: string[] = []; // Lista dinámica de colonias
  emisores: string[] = [];
  regimenesFiscales = [
    { codigo: '601', descripcion: 'General de Ley Personas Morales' },
    { codigo: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
    { codigo: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { codigo: '606', descripcion: 'Arrendamiento' },
    { codigo: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes' },
    { codigo: '608', descripcion: 'Demás Ingresos' },
    { codigo: '609', descripcion: 'Consolidación' },
    { codigo: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
    { codigo: '611', descripcion: 'Ingresos por Dividendos (Socios y Accionistas)' },
    { codigo: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { codigo: '614', descripcion: 'Ingresos por Intereses' },
    { codigo: '615', descripcion: 'Régimen de los Ingresos por Obtención de Premios' },
    { codigo: '616', descripcion: 'Sin Obligaciones Fiscales' },
    { codigo: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
    { codigo: '621', descripcion: 'Incorporación Fiscal' },
    { codigo: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { codigo: '623', descripcion: 'Opcional para Grupos de Sociedades' },
    { codigo: '624', descripcion: 'Coordinados' },
    { codigo: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { codigo: '626', descripcion: 'Régimen Simplificado de Confianza' },
  ]; // Lista de regímenes fiscales del SAT
  isFactura: boolean = false; // Controla si el comprobante es factura

  @Input() clienteEditable: any = null; // Cliente a editar
  @Output() clienteUpdated = new EventEmitter<any>(); // Emite datos actualizados al componente principal

  constructor(private fb: FormBuilder, private apiService: ApiService, private toast: NgToastService) {}

  ngOnInit(): void {
    // Configuración del formulario reactivo con grupos
    this.clienteForm = this.fb.group({
      datosGenerales: this.fb.group({
        nombre: ['', Validators.required],
        aPaterno: ['', Validators.required],
        aMaterno: [''],
        nombreEmpresa: [''],
        estatus: ['pendiente', Validators.required],
      }),
      contacto: this.fb.group({
        telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
        correo: ['', [Validators.required, Validators.email]],
      }),
      domicilio: this.fb.group({
        calle: ['', Validators.required],
        numeroExterior: ['', Validators.required],
        numeroInterior: [''],
        colonia: ['', Validators.required],
        codigoPostal: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
        estado: ['', Validators.required],
        municipio: ['', Validators.required],
      }),
      datosComerciales: this.fb.group({
        comprobante: ['recibo', Validators.required],
        emisorComprobante: ['RORA550825F90 - Amhy Belen Marquez Ramirez', Validators.required],
        diaCorte: [null, [Validators.required, Validators.min(1), Validators.max(31)]],
        fechaCorte: [''],
        fechaPago: [''],
        correoFactura: [''],
        rfcFactura: [''],
        regimenFiscal: [''],
        banco: [''],
        cuentaBancaria: [''],
        domicilioFiscal: [''],
        razonSocial: [''],
      }),
    });

    this.onDiaCorteChange();
    this.onComprobanteChange({ value: 'recibo' });

    // Inicializa los cambios reactivos del código postal
  this.initCodigoPostalChange();
  }

  /**
   * Abre el modal y precarga los datos del cliente seleccionado.
   */
  open(cliente: any): void {
    this.isVisible = true;
    this.clienteEditable = cliente;
    this.idCliente = cliente.idCliente;
  
    // Asignar valores al formulario
    this.clienteForm.patchValue({
      datosGenerales: {
        nombre: cliente.nombre,
        aPaterno: cliente.aPaterno,
        aMaterno: cliente.aMaterno,
        nombreEmpresa: cliente.nombreEmpresa,
        estatus: cliente.estatus,
      },
      contacto: {
        telefono: cliente.contacto.telefono,
        correo: cliente.contacto.correo,
      },
      domicilio: {
        calle: cliente.domicilio.calle,
        numeroExterior: cliente.domicilio.numeroExterior,
        numeroInterior: cliente.domicilio.numeroInterior,
        colonia: cliente.domicilio.colonia,
        codigoPostal: cliente.domicilio.codigoPostal,
        estado: cliente.domicilio.estado,
        municipio: cliente.domicilio.municipio,
      },
      datosComerciales: {
        comprobante: cliente.datosComerciales.comprobante,
        emisorComprobante: cliente.datosComerciales.emisorComprobante,
        diaCorte: cliente.datosComerciales.diaCorte,
        fechaCorte: cliente.datosComerciales.fechaCorte
          ? new Date(cliente.datosComerciales.fechaCorte).toISOString().split('T')[0]
          : '',
        fechaPago: cliente.datosComerciales.fechaPago
          ? new Date(cliente.datosComerciales.fechaPago).toISOString().split('T')[0]
          : '',
        correoFactura: cliente.datosComerciales.correoFactura || '',
        rfcFactura: cliente.datosComerciales.rfcFactura || '',
        regimenFiscal: cliente.datosComerciales.regimenFiscal || '',
        banco: cliente.datosComerciales.banco || '',
        cuentaBancaria: cliente.datosComerciales.cuentaBancaria || '',
        domicilioFiscal: cliente.datosComerciales.domicilioFiscal || '',
        razonSocial: cliente.datosComerciales.razonSocial || '',
      },
    });
  
    this.onComprobanteChange({ value: cliente.datosComerciales.comprobante });
  }
  
  
  
  initCodigoPostalChange(): void {
    const codigoPostalControl = this.clienteForm.get('domicilio.codigoPostal');
  
    codigoPostalControl?.valueChanges.subscribe((codigoPostal) => {
      if (codigoPostal && /^[0-9]{5}$/.test(codigoPostal)) {
        this.apiService.getColoniasByCodigoPostalFromGoogle(codigoPostal).subscribe({
          next: (response) => {
            console.log('Respuesta completa de la API:', response);
  
            let coloniasEncontradas = response.results.flatMap((result: any) =>
              result.postcode_localities ||
              result.address_components.filter((component: any) =>
                component.types.includes('neighborhood') || component.types.includes('sublocality')
              ).map((component: any) => component.long_name)
            );
  
            this.colonias = Array.from(new Set(coloniasEncontradas));
            console.log('Colonias encontradas:', this.colonias);
  
            const estadoComponent = response.results[0]?.address_components.find((component: any) =>
              component.types.includes('administrative_area_level_1')
            );
  
            const municipioComponent = response.results[0]?.address_components.find((component: any) =>
              component.types.includes('locality')
            );
  
            const estado = estadoComponent?.long_name || '';
            const municipio = municipioComponent?.long_name || '';
  
            this.clienteForm.patchValue({
              domicilio: {
                estado,
                municipio,
              },
            });
          },
          error: (error) => {
            console.error('Error al obtener colonias:', error);
            this.colonias = [];
          }
      });
      } else {
        this.colonias = [];
        this.clienteForm.get('domicilio')?.patchValue({
          estado: '',
          municipio: '',
          colonia: '',
        });
      }
    });
  }
  


  /**
   * Cierra el modal y resetea el formulario.
   */
  close(): void {
    this.isVisible = false;
    this.resetForm();
  }

  /**
   * Restablece el formulario a valores predeterminados.
   */
  resetForm(): void {
    this.clienteForm.reset({
      datosGenerales: {
        nombre: '',
        aPaterno: '',
        aMaterno: '',
        nombreEmpresa: '',
        estatus: 'pendiente',
      },
      contacto: {
        telefono: '',
        correo: '',
      },
      domicilio: {
        calle: '',
        numeroExterior: '',
        numeroInterior: '',
        colonia: '',
        codigoPostal: '',
        estado: '',
        municipio: '',
      },
      datosComerciales: {
        comprobante: 'recibo',
        emisorComprobante: 'RORA550825F90 - Amhy Belen Marquez Ramirez',
        diaCorte: null,
        fechaCorte: '',
        fechaPago: '',
        correoFactura: '',
        rfcFactura: '',
        regimenFiscal: '',
        banco: '',
        cuentaBancaria: '',
        domicilioFiscal: '',
        razonSocial: '',
      },
    });
    this.idCliente = null;
    this.clienteEditable = null;
    this.emailExistsError = false;
  }


  /**
   * Escucha cambios en el campo "Día de Corte" y calcula automáticamente las fechas.
   */
  onDiaCorteChange(): void {
    const diaCorteControl = this.clienteForm.get('datosComerciales.diaCorte');
    diaCorteControl?.valueChanges.subscribe((diaCorte) => {
      if (diaCorte && diaCorte >= 1 && diaCorte <= 31) {
        const today = new Date();
        const fechaCorte = new Date(today.getFullYear(), today.getMonth(), diaCorte);

        if (fechaCorte < today) {
          fechaCorte.setMonth(fechaCorte.getMonth() + 1);
        }

        const fechaPago = new Date(fechaCorte);
        fechaPago.setDate(fechaPago.getDate() + 9);

        this.clienteForm.patchValue({
          datosComerciales: {
            fechaCorte: fechaCorte.toISOString().split('T')[0],
            fechaPago: fechaPago.toISOString().split('T')[0],
          },
        });
      } else {
        this.clienteForm.patchValue({
          datosComerciales: {
            fechaCorte: '',
            fechaPago: '',
          },
        });
      }
    });
  }

   /**
   * Cambia los emisores y los campos visibles dependiendo del comprobante seleccionado.
   */
   onComprobanteChange(event: any): void {
    const value = event.value;
    this.isFactura = value === 'factura';
  
    const datosComercialesGroup = this.clienteForm.get('datosComerciales') as FormGroup;
  
    if (value === 'recibo') {
      this.emisores = ['RORA550825F90 - Amhy Belen Marquez Ramirez'];
      datosComercialesGroup.get('correoFactura')?.clearValidators();
      datosComercialesGroup.get('rfcFactura')?.clearValidators();
      datosComercialesGroup.get('regimenFiscal')?.clearValidators();
      datosComercialesGroup.get('razonSocial')?.clearValidators();
  
      datosComercialesGroup.get('correoFactura')?.updateValueAndValidity();
      datosComercialesGroup.get('rfcFactura')?.updateValueAndValidity();
      datosComercialesGroup.get('regimenFiscal')?.updateValueAndValidity();
      datosComercialesGroup.get('razonSocial')?.updateValueAndValidity();
  
      datosComercialesGroup.patchValue({
        correoFactura: '',
        rfcFactura: '',
        regimenFiscal: '',
        razonSocial: '',
        banco: '',
        cuentaBancaria: '',
        domicilioFiscal: '',
      });
    } else if (value === 'factura') {
      this.emisores = ['RORJ820825SM4 - Julio César de la Rosa Rivas'];
      datosComercialesGroup.get('correoFactura')?.setValidators([Validators.required, Validators.email]);
      datosComercialesGroup.get('rfcFactura')?.setValidators([Validators.required]);
      datosComercialesGroup.get('regimenFiscal')?.setValidators([Validators.required]);
      datosComercialesGroup.get('razonSocial')?.setValidators([Validators.required]);
  
      datosComercialesGroup.get('correoFactura')?.updateValueAndValidity();
      datosComercialesGroup.get('rfcFactura')?.updateValueAndValidity();
      datosComercialesGroup.get('regimenFiscal')?.updateValueAndValidity();
      datosComercialesGroup.get('razonSocial')?.updateValueAndValidity();
    }
  }
  

  /**
   * Envía los datos actualizados cuando el formulario es válido.
   */
  onSubmit(): void {
    if (this.clienteForm.valid) {
      const formValue = this.clienteForm.value;

      const clienteActualizado = {
        idCliente: this.idCliente,
        ...formValue.datosGenerales,
        contacto: formValue.contacto,
        domicilio: formValue.domicilio,
        datosComerciales: formValue.datosComerciales,
      };

      console.log('Cliente actualizado:', clienteActualizado);
      this.clienteUpdated.emit(clienteActualizado);
      this.close();
    } else {
      console.error('Formulario inválido:', this.clienteForm.errors);
    }
  }


  /**
   * Getters para acceder a grupos del formulario desde la plantilla.
   */
  get datosGeneralesGroup(): FormGroup {
    return this.clienteForm.get('datosGenerales') as FormGroup;
  }

  get contactoGroup(): FormGroup {
    return this.clienteForm.get('contacto') as FormGroup;
  }

  get domicilioGroup(): FormGroup {
    return this.clienteForm.get('domicilio') as FormGroup;
  }

  get datosComercialesGroup(): FormGroup {
    return this.clienteForm.get('datosComerciales') as FormGroup;
  }
}
