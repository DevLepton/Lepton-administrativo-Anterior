import { Component, EventEmitter, Output } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgToastService } from 'ng-angular-popup';

@Component({
  selector: 'app-register-user-modal',
  templateUrl: './register-user-modal.component.html',
  styleUrls: ['./register-user-modal.component.scss']
})
export class RegisterUserModalComponent {
  @Output() userRegistered = new EventEmitter<any>();

  showModal = false;
  form!: FormGroup;
  hide = true;           // mostrar/ocultar contraseña
  loading = false;       // estado de carga para botón y barra

  constructor(
    private apiService: ApiService,
    private fb: FormBuilder,
    private toast: NgToastService
  ) {
    this.form = this.fb.group({
      userName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['admin', Validators.required]
    });
  }

  open() {
    this.showModal = true;
  }

  close() {
    this.showModal = false;
    // Resetea y vuelve a estado inicial
    this.form.reset({ userName: '', email: '', password: '', role: 'admin' });
    this.loading = false;
    this.hide = true;
  }
/*
  Verte en el vip de lejitos es un privilegio, tú loquita por que te cojan, ya yo le voy a pedir que te lo expliquen, tú lo que quieres es que te chinguen, tienes la disco de museo mas tú eres arte, hoy tengo que hablarte, ojalá y tenga suerte, si subiste una story es pa que te la comenten, que andas bonita y suelta, yo quiero saber con qué pantisito te acuestas, porque no cualquiera puede llegarte, yo pagué pa verte, pa ganarte y por más que me ignoras ta imposible ignorarte, tu ex todavía te hostiga porque tú te cotizas, vente conmigo.
  Me tienes el bicho ansioso, quedate en 4 que se ve presioso, si abres una iglesia me hago religioso, encima de mí fue que te conocí, mami tu eres así, no te hagas, yo también soy así, si el calor es de 90, el aguasero es de 100, vamos a pasarla bien, y enamorarme es bien fácil, pero olvidarme es dificil, y nadie se ha enterado, todos los mensajes archivado, tu me prendes como fósforo, si quieres madrugo pa hacertelo temprano, siempre te doy con los troyanos, si preguntan diles con somos primos lejanos, porque yo soy un cuero y tú también, pero dale easy, easy, que sabes que soy piscis.
  Baby, bésame la boca, aunque te sepa a vodka, vida peligrosa, niña, claro que se nota, en el antro bien coco, y me pongo bien loco, fuerza régida, viejo, fancy, ella es una fresa, mueve su cadera, todos la desean, plebe está buena, patrullando a los monstruos, me siguen bailando, quieren que las ponga en 4, con las luces en rojo, tu vato no sabe que yo te provoco.
  Carros de mercancía directa que le manda el cliente, se me ven, me chingué un pase en caliente, vendiendo libras, gastando libras, perfíl de artista y no salgo en las revistas, cuerno colorado, y bien jalapeño, compadre, las amras exportadas me las mandan en paquetes, la gorrita pa adelante, insta privado, only fresitas.
  Sé que yo no soy el mismo, y en mi cuello una cadena con diamantes, de la pobreza fui a salvarme, loco, pero bien enamorado, se ve que me la paso a toda madre, niña, no me digas que no, que esta noche te hago el amor, vida recia, lujos, fama, joyas, culos, tengo todo y nada me llena, ah qué buena vida llevo, por esos ojos yo robo y mato, por esos ojos me hice malanadro.
  No sé si tu boca está besando a otro en estos momentos, y no sé si tus ojos ya se olvidaron de mí, y me pregunto qué hubiera pasado, si estuviésemos juntos, aún enamorados, todavía yo te espero, aunque yo sé que tú no vas a volver, te digo la verdad, te extraño el 14 y en la navidad, siempre dejaba ropa interior, ahora me paso en el putero, a otra persona no he podido amar, desde que te fuiste sigo transtornado, cada cual por su lado.
  Ella desaparece, pero aparece cuando le dan ganas, se hace la que no quiere, pero llama de madrugada, se hace la difícil, pero se va, pidiéndo que le llegue, que a ella me entregue, aunque a veces me niegue, quería un gatito y lo cazó, a veces la rola y la weed, tiene a todos los nenes loco y a todas las nenas loca, anda con la amiga siempre arrebatada, prende, pasa, dime qué pasó.
  Ella está casi, casi soltera, quieren perreo la noche entera, sin cojones le tienen si se entera, tiene como a 20 en lista de espera, un bellaqueo con destino, chingo con el gato, pero no se vino, dame eso, yo te lo devuelvo, ya son las 10 y se empezó a maquillar, no sé cómo todavía no ha salido en un video, un corrido de bandolera.
  Sé que te pones bellaca con esa bolsita de rosa lavada, y para qué pedir discusiones, lo hacemos con canciones, no creo en el amor, irnos de vacaciones, chocolates y flores, arriba del rubicon, sé que eres buena persona, ya nadie me dice, ya nadie me espanta, sé que hay weyes que te tiran, si tú me llamas yo voy a verte, lo hacemos con canciones, podemos arreglar los errores.
  Ya no llames, bebé, ya no te quiero ver, mucho menos saber el porqué te marchaste, evítame la pena de tratarte bien culero, como si no fueras nadie, fuero mil noches enteras, bajo la luna llena nos estorbó toda la ropa, dos tres noches sin parar, pero preferiste otro querer, que según sí te valorara, todo lo que empieza también un día se acaba, las domperi por aca, mota cherry por allá, y se acabó, chiquita.
  Quiero darles la gracias a tu mamá y a tu papá por darte la vida, obvio que hablo de ti, la que me hace feliz, de esos ojitos bellos quiero ser el dueño, pa que nada te pase, porque has de saber que yo estoy hecho pa ti, has de saber que tú estás hecha pa mi, así a la medida, donde andabas perdida, todo de mí te pertenece, al año soy tuyo, nomás 12 meses, al amor y a ti los conocí el mismo día, le doy gracias a dios poruqe me mandó lo que tanto pedía.
  Sé que yo no soy el mismo que en mi cuello una cadena de diamantes, de la pobreza fui a salvarme, loco pero bien enamorado, bien bendecido por mi madre, por esos ojos yo robo y mato, mija, no me digas que no, por esos ojos me hice malandro, que esta noche te hago el amor, vida recia, lujos, fama, culos, tengo todo y nada me llena, el   
  
  */
  submit() {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.apiService.registerUser(this.form.value).subscribe({
      next: (user) => {
        this.toast.success({
          detail: 'Éxito',
          summary: 'Usuario registrado correctamente.',
          duration: 3000,
        });
        this.userRegistered.emit(user);
        this.close();
      },
      error: (err) => {
        console.error(err);
        this.toast.error({
          detail: 'Error',
          summary: 'Error al registrar usuario. Intenta de nuevo.',
          duration: 3500,
        });
        this.loading = false;
      }
    });
  }

  onBackdropClick(event: MouseEvent): void {
    this.close();
  }

}
