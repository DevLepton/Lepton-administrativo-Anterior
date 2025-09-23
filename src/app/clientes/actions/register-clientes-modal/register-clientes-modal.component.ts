import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { MatStepper } from '@angular/material/stepper';
import { NgToastService } from 'ng-angular-popup';
@Component({
  selector: 'app-register-clientes-modal',
  templateUrl: './register-clientes-modal.component.html',
  styleUrls: ['./register-clientes-modal.component.scss'],
})
export class RegisterClientesModalComponent implements OnInit {
  isVisible = false; // Control de visibilidad del modal
  clienteForm!: FormGroup; // Formulario reactivo
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


  @Output() clienteRegistered = new EventEmitter<any>(); // Evento para enviar el cliente registrado

  constructor(private fb: FormBuilder, private apiService: ApiService, private toast: NgToastService) { }

  ngOnInit(): void {
    // Configuración del formulario reactivo con los 4 grupos de datos
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

    // Configura el listener para calcular las fechas automáticas
    this.onDiaCorteChange();
    this.onComprobanteChange({ value: 'recibo' });
    this.onCodigoPostalChange();
  }

  /**
   * Getter para acceder al grupo "Datos Generales" de forma sencilla
   */
  get datosGeneralesGroup(): FormGroup {
    return this.clienteForm.get('datosGenerales') as FormGroup;
  }

  /**
   * Getter para el grupo "Contacto"
   */
  get contactoGroup(): FormGroup {
    return this.clienteForm.get('contacto') as FormGroup;
  }

  /**
  * Valida si el correo ya está registrado antes de avanzar al siguiente paso.
  */
  checkEmailBeforeProceeding(stepper: MatStepper): void {
    const emailControl = this.contactoGroup.get('correo');
    const email = emailControl?.value;

    if (!emailControl?.valid) {
      emailControl?.markAsTouched(); // Mostrar errores de validación
      return;
    }

    this.apiService.checkEmailExists(email).subscribe({
      next: (response) => {
        if (response.exists) {
          this.emailExistsError = true;
          emailControl.setErrors({ emailExists: true });
          // Mostrar un mensaje de error con el servicio de alertas
          this.toast.error({
            detail: 'Error',
            summary: 'El correo electrónico ya está registrado.',
            duration: 5000,
          });
        } else {
          this.emailExistsError = false;
          emailControl.setErrors(null); // Limpiar errores si el correo es válido
          stepper.next(); // Avanzar al siguiente paso
        }
      },
      error: (error) => {
        console.error('Error al verificar el correo:', error);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al verificar el correo. Intente nuevamente.',
          duration: 5000,
        });
      }
    });
  }




  /**
   * Getter para el grupo "Domicilio"
   */
  get domicilioGroup(): FormGroup {
    return this.clienteForm.get('domicilio') as FormGroup;
  }

  /**
   * Getter para el grupo "Datos Comerciales"
   */
  get datosComercialesGroup(): FormGroup {
    return this.clienteForm.get('datosComerciales') as FormGroup;
  }

  /**
   * Abre el modal y reinicia el formulario.
   */
  open(): void {
    this.isVisible = true;
    this.resetForm();
  }

  /**
   * Cierra el modal y limpia el formulario.
   */
  close(): void {
    this.isVisible = false;
    this.resetForm();
  }

  /**
   * Restablece el formulario a los valores predeterminados.
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
    this.emailExistsError = false; // Resetear el estado del error de correo
    this.onComprobanteChange({ value: 'recibo' }); // Reinicia los emisores y campos dinámicos
  }

  /**
   * Escucha cambios en el campo "Día de Corte" y calcula las fechas correspondientes.
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
        fechaPago.setDate(fechaPago.getDate() + 10);

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

    if (value === 'recibo') {
      this.emisores = ['RORA550825F90 - Amhy Belen Marquez Ramirez'];
      this.clienteForm.get('datosComerciales')?.patchValue({
        correoFactura: '',
        rfcFactura: '',
        regimenFiscal: '',
        banco: '',
        cuentaBancaria: '',
        domicilioFiscal: '',
        razonSocial: '',
      });
    } else if (value === 'factura') {
      this.emisores = ['RORJ820825SM4 - Julio César de la Rosa Rivas'];
    }
  }

  onCodigoPostalChange(): void {
    const codigoPostalControl = this.clienteForm.get('domicilio.codigoPostal');

    codigoPostalControl?.valueChanges.subscribe((codigoPostal) => {
      if (codigoPostal && /^[0-9]{5}$/.test(codigoPostal)) {
        this.apiService.getColoniasByCodigoPostalFromGoogle(codigoPostal).subscribe({
          next: (response) => {
            console.log('Respuesta completa de la API:', response);
            console.log('Estructura completa del resultado:', JSON.stringify(response.results, null, 2)); // Aquí se imprime la estructura

            // Usa postcode_localities para colonias si están disponibles
            let coloniasEncontradas = response.results.flatMap((result: any) =>
              result.postcode_localities ||
              result.address_components.filter((component: any) =>
                component.types.includes('neighborhood') || component.types.includes('sublocality')
              ).map((component: any) => component.long_name)
            );

            coloniasEncontradas = Array.from(new Set(coloniasEncontradas)); // Elimina duplicados
            this.colonias = coloniasEncontradas;

            console.log('Colonias encontradas:', this.colonias);

            if (this.colonias.length === 0) {
              this.toast.warning({
                detail: 'Advertencia',
                summary: 'No se encontraron colonias para este código postal.',
                duration: 5000,
              });
            }

            // Recorrer los resultados para obtener estado y municipio
            const estadoComponent = response.results[0]?.address_components.find((component: any) =>
              component.types.includes('administrative_area_level_1')
            );

            const municipioComponent = response.results[0]?.address_components.find((component: any) =>
              component.types.includes('locality')
            );

            const estado = estadoComponent?.long_name || '';
            const municipio = municipioComponent?.long_name || '';

            if (!municipio) {
              console.error('El municipio no se encontró en los datos proporcionados por la API.');
            }

            console.log('Estado:', estado, 'Municipio:', municipio);

            // Actualizar formulario reactivo
            this.clienteForm.patchValue({
              domicilio: {
                estado,
                municipio,
                colonia: '',
              },
            });
          },
          error: (error) => {
            console.error('Error al obtener colonias:', error);
            this.colonias = []; // Limpia la lista si hay error
            this.toast.error({
              detail: 'Error',
              summary: 'No se pudieron cargar las colonias. Intente más tarde.',
              duration: 5000,
            });
          }
        });
      } else {
        this.colonias = []; // Limpia la lista si el código postal no es válido
        this.clienteForm.get('domicilio')?.patchValue({
          estado: '',
          municipio: '',
          colonia: '',
        });
      }
    });
  }







  /**
   * Maneja la acción de guardar los datos del cliente.
   * Envía los datos en un formato plano al componente principal.
   */
  onSubmit(): void {
    if (this.clienteForm.valid) {
      const formValue = this.clienteForm.value;

      // Aplanar el objeto antes de enviarlo al servidor
      const clienteData = {
        ...formValue.datosGenerales, // Extraer datos generales al nivel raíz
        domicilio: formValue.domicilio, // Mantener domicilio como objeto
        contacto: formValue.contacto, // Mantener contacto como objeto
        datosComerciales: formValue.datosComerciales, // Mantener datos comerciales como objeto
      };

      console.log('Cliente a enviar:', clienteData); // Verificar en consola

      // Emitir los datos al componente principal
      this.clienteRegistered.emit(clienteData);
      this.close();
    } else {
      console.error('Formulario inválido:', this.clienteForm.errors);
    }
  }
}
