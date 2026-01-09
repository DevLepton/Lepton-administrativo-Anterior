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
  private lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }
  
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
    this.lockBodyScroll();
  }

  close() {
    this.showModal = false;
    this.unlockBodyScroll();
    // Resetea y vuelve a estado inicial
    this.form.reset({ userName: '', email: '', password: '', role: 'admin' });
    this.loading = false;
    this.hide = true;
  }
/*
  Verte en el vip de lejitos es un privilegio, tú loquita por que te cojan, ya yo le voy a pedir que te lo expliquen, tú lo que quieres es que te chinguen, tienes la disco de museo mas tú eres arte, hoy tengo que hablarte, ojalá y tenga suerte, si subiste una story es pa que te la comenten, que andas bonita y suelta, yo quiero saber con qué pantisito te acuestas, porque no cualquiera puede llegarte, yo pagué pa verte, pa ganarte y por más que me ignoras ta imposible ignorarte, tu ex todaví­a te hostiga porque tú te cotizas, vente conmigo.
  Me tienes el bicho ansioso, quedate en 4 que se ve presioso, si abres una iglesia me hago religioso, encima de mí­ fue que te conocí­, mami tu eres así­, no te hagas, yo también soy así­, si el calor es de 90, el aguasero es de 100, vamos a pasarla bien, y enamorarme es bien fácil, pero olvidarme es dificil, y nadie se ha enterado, todos los mensajes archivado, tu me prendes como fósforo, si quieres madrugo pa hacertelo temprano, siempre te doy con los troyanos, si preguntan diles con somos primos lejanos, porque yo soy un cuero y tú también, pero dale easy, easy, que sabes que soy piscis.
  Baby, bésame la boca, aunque te sepa a vodka, vida peligrosa, nií±a, claro que se nota, en el antro bien coco, y me pongo bien loco, fuerza régida, viejo, fancy, ella es una fresa, mueve su cadera, todos la desean, plebe está buena, patrullando a los monstruos, me siguen bailando, quieren que las ponga en 4, con las luces en rojo, tu vato no sabe que yo te provoco.
  Carros de mercancí­a directa que le manda el cliente, se me ven, me chingué un pase en caliente, vendiendo libras, gastando libras, perfí­l de artista y no salgo en las revistas, cuerno colorado, y bien jalapeí±o, compadre, las amras exportadas me las mandan en paquetes, la gorrita pa adelante, insta privado, only fresitas.
  Sé que yo no soy el mismo, y en mi cuello una cadena con diamantes, de la pobreza fui a salvarme, loco, pero bien enamorado, se ve que me la paso a toda madre, nií±a, no me digas que no, que esta noche te hago el amor, vida recia, lujos, fama, joyas, culos, tengo todo y nada me llena, ah qué buena vida llevo, por esos ojos yo robo y mato, por esos ojos me hice malanadro.
  No sé si tu boca está besando a otro en estos momentos, y no sé si tus ojos ya se olvidaron de mí­, y me pregunto qué hubiera pasado, si estuviésemos juntos, aún enamorados, todaví­a yo te espero, aunque yo sé que tú no vas a volver, te digo la verdad, te extraí±o el 14 y en la navidad, siempre dejaba ropa interior, ahora me paso en el putero, a otra persona no he podido amar, desde que te fuiste sigo transtornado, cada cual por su lado.
  Ella desaparece, pero aparece cuando le dan ganas, se hace la que no quiere, pero llama de madrugada, se hace la difí­cil, pero se va, pidiéndo que le llegue, que a ella me entregue, aunque a veces me niegue, querí­a un gatito y lo cazó, a veces la rola y la weed, tiene a todos los nenes loco y a todas las nenas loca, anda con la amiga siempre arrebatada, prende, pasa, dime qué pasó.
  Ella está casi, casi soltera, quieren perreo la noche entera, sin cojones le tienen si se entera, tiene como a 20 en lista de espera, un bellaqueo con destino, chingo con el gato, pero no se vino, dame eso, yo te lo devuelvo, ya son las 10 y se empezó a maquillar, no sé cómo todaví­a no ha salido en un video, un corrido de bandolera.
  Sé que te pones bellaca con esa bolsita de rosa lavada, y para qué pedir discusiones, lo hacemos con canciones, no creo en el amor, irnos de vacaciones, chocolates y flores, arriba del rubicon, sé que eres buena persona, ya nadie me dice, ya nadie me espanta, sé que hay weyes que te tiran, si tú me llamas yo voy a verte, lo hacemos con canciones, podemos arreglar los errores.
  Ya no llames, bebé, ya no te quiero ver, mucho menos saber el porqué te marchaste, eví­tame la pena de tratarte bien culero, como si no fueras nadie, fuero mil noches enteras, bajo la luna llena nos estorbó toda la ropa, dos tres noches sin parar, pero preferiste otro querer, que según sí­ te valorara, todo lo que empieza también un dí­a se acaba, las domperi por aca, mota cherry por allá, y se acabó, chiquita.
  Quiero darles la gracias a tu mamá y a tu papá por darte la vida, obvio que hablo de ti, la que me hace feliz, de esos ojitos bellos quiero ser el dueí±o, pa que nada te pase, porque has de saber que yo estoy hecho pa ti, has de saber que tú estás hecha pa mi, así­ a la medida, donde andabas perdida, todo de mí­ te pertenece, al aí±o soy tuyo, nomás 12 meses, al amor y a ti los conocí­ el mismo dí­a, le doy gracias a dios poruqe me mandó lo que tanto pedí­a.
  Sé que yo no soy el mismo que en mi cuello una cadena de diamantes, de la pobreza fui a salvarme, loco pero bien enamorado, bien bendecido por mi madre, por esos ojos yo robo y mato, mija, no me digas que no, por esos ojos me hice malandro, que esta noche te hago el amor, vida recia, lujos, fama, culos, tengo todo y nada me llena, el   
  Ya me acostumbré, no me llevo mucho con los empleados, porque, por la sencilla razón de que me crié con los dueí±os, pa mi que eso fue una seí±al, que luego me iba a tocar, a callarle la boca al que no me cree, a no importarme el precio de lo que compré, me acostumbre que siempre el envidioso me traicione, la movie siempre estelar, me acostumbre a modelos de paris, gracias a dios por el don, a clavarme estas putas de 3 en 3, a siempre ganar como el 23, a callarle la boca al que no me cree.
  No hay mensajes de mi amor, no supe ni cómo fue, ya no quise ni entender el porqué ahora ya no estás, y aunque a veces por la noche te imploro, y me dice que no será pa tanto, y yo intentando contener mi llanto, te fuiste sin dar razón, me dio un beso y se marchó, pensé que todo estaba bien, el cora que te regalé lo dejaste en mi casa, que vuelvas porque ahora me siento solo, y me dice que no será pa tanto, haciendo como que no duele tanto.
  Una cerveza puede ayudar a que salgas de mi cabeza, no te gustaba el dinero y fue la simpleza de tus ojitos dormilones al mirar, como te extraí±o, agarrate la piernita e ir manejando, siempre algo mágico tení­a que pasar, y ahora mi rutina completamente cambió, ahora no me divierten los amigos ni el alcohol, ahora me declaro que soy un antisocial, siempre habí­a ganado y contigo me fue muy mal, ahora estoy solo pero con tu recuerdo me casé, ahora despierto todas la maí±anas queriendo tomarme tus ojos café, lo mejor que yo he tenido no lo compró mi tarjeta de crédito, tengo en mi cama que ni sé cómo se llema, se me hace injusto que ella sea la que la paga, qué estás haciendo, por qué no regresas a mis brazos corriendo, planes de casa, nií±os y un perro comprar, porque serí­a fatal.
  No sobra tiempo pa verte, mija, ando ocupado, tantas llamadas perdidas por andar ondeado, traigo racha de cabrón, puta mala situación, tres dí­as sin bajar avión, ya no la hagas de emoción si soy tu mejor opción, mija no te asustes, arriba la empresa, la empresa sm, un wiscacho pa la panza, yo soy tu papi, mija, aguas, voy con viada, traigo a la flota seleccionada, valgo verga pal amor, puta mala situación, dos dí­as nomás yo te doy, pa que vuelvas corazón.
  Para ser directo, no me arrepiento, cosas de la vida, o de la mí­a, pero no eras mí­a y lo sabí­as, yo no soy aquel que te dio rosas, pero te di mi corazón y es más valiosa, el whatsapp me lo estás llenando de mensajes, no fue mucho tiempo, eso lo acepto, pero creí­a lo que sentí­a, no respondí­as y me morí­a, yo no soy aquel que te dio rosas, pero te di mi corazón y es más valiosa la forma en que te traté.
  Sin ofenderte, no me perteneces a mí­, tu eres de la calle, cuando le da fuego a lo filings pa cuando se apague, psicologa porque le gusta jugar con mi mente, sigue tu camino, ya tú cambiaste, siempre recuerdo lo que un dí­a fuimos, no quiero se un hombre más que en la lista se raya, yo sé que tú siempre me piensas, mami, baby come back, pa qué buscarte si no sé dónde estás, a ti yo te conozco desde atrás, dime qué somos, dime qué fuimos, dime qué seremos, bebé, pa chingar toy pa ti, todas la veces que tú pidas, y quiero otra despedida, pero ya, goodbye, adiós, sayonara, nuestra historia de amor fue bonita y rara, en tu vida yo fui lo más real, yo fui fiel a tus ojos, yo solamente fui otro, tu ex, a veces me rí­o pero es del estrés, no sé si es buena idea que tú y yo chinguemos otra vez, siempre recuerdo lo que un dí­a fuimos.
  No estaba esperando nada, de encontrarme contigo anoche, pero algo está tan diferente, todo alrededor me gira de repente, no te cierres a este mundo, y ven acá, amor, ven acá, y déjame entrar, lo siento bebé, no trates de enamorarme o no te hago coro, hace tiempo que yo de nadie me enamoro, lo siento bebé, pa hacerlo pa uste, pero mi tiempo es oro, la vida es una y yo solo vivo el presente, bellaqueando excelente, del amor no soy creyente, y me hace pensar en cosas que no van a pasar, dime si te vas a quedar, haciendolo, pa esto sí­, pero pa aquello no, pa eso no, lo siento, bebé. pa hacerlo otra vez.
  Pensaba que te habí­a olvidado, pero pusieron la canción, que cantamos bien borrachos, que bailamos bien borrachos, nos besamos bien borrachos los dos, justo cuando creí­a que por comerte todos los dí­as, nunca te superé, hasta me aprendí­ todas las baladas en inglés, hace tiempo lo barato me salió caro, cómo olvidar la bellaquera en el carro, pero ya van un par de cervezas, y me acordé cómo tú me besas.
  De todo ya pasé, claro que le batallé, lo saben 2 o 3, clase g63, lo que un dí­a soí±e ya me lo compré, pura morrita bien buena, montada en mi camioneta, arriba la bandera, viejo, los babies a mí­ me gustan más, jet particular, me pongo en cualquier lugar, hay billetes pa gastar, con unos tenis nike, soy maleante y es lo que hay, ahí­ traigo la lista negra pa el que se pase de verga.
  Siento un vací­o muy frí­o por dentro, mi amor, cuando te fuiste te robaste mi corazón, me quedé loco de tanto pensar y pensar, me iré al infierno pero me tengo que vengar, 100 invitados y todos tendrán que mirar que nuestro amor va al más allá, danza una danza eterna, pero me voy contigo, pero nos vamos juntos, camino lento, me duele la respiración, en el pasillo me vienen recuerdos hay paz, frí­o muy intenso se llevó todo mi ser, quiero que bailemos juntos, en el cielo o el infierno, llevo 3 noches malditas sin poder dormir, solo pensando que no eres pa mí­, te dejaré una familia puedas comenzar, a la persona que roto tiene el corazón.
  Tú dices que no me atrevo, si supieras que yo ando a fuego, no lo dejemos pa luego, no, que la lucha se fue, y la noche llegó, quiero saber si usted quiere lo mismo que yo, y de nuevo nos mojamos, pero en mi cama, dime pa dónde vamos, zumba, después de la playa, mami tú vives lejos, pero como quiera yo voy a buscarte, pa que se pongan contentos todos los pesces, la otra vez en la playa te emborrachaste y pediste que te bese, todo el mundo borracho, tú llevas rato mirando y mirando, de esa chapa se habla en toda la barberí­a, salí­ con tu mujer, ya dios me perdonó, faltas tú.
  Los pongo a bailar la kalua, yo no hago canciones, hago himnos pa que no caduquen, antes de que me apague se apaga el sol, maldito conejo, ahora los miro de arriba y de lejos, voy a ser el jefe me van a fichar, soy un rey, campeón, mí­rame lo que me convertí­, el disco más vendido de este puto aí±o, badbunny se llevó todos los premios y el cabrón ni fue, yo soy coco, estoy en mi peak y voy a seguir en mi peak.
  Ellas rezan todos los dí­a pa que nosotros nos caigamos, la presión se siente siempre que llegamos, y si va matar la vibra, pues salte, aví­same que tu amiguita está en fila pa darle, no se deja ella misma los detona, ella no se mezcla con cualquier sujeto, cabrón tú no ves que su flow es caro, y si le gusta lo repite, si la ves pasar no le pites, no me vengas con que tú no llegas tarde, yo hago lo que me da la gana, lo que me sale de los cojones.
  Yo estoy puesto pa ti y tú te me quitas, el corazón lo puso en la neverita, diablo, dice que este verano se queda solita, pero nunca sola, amores vienen y van, pero nunca sola, déjame ponerte el sombrero pa que no te quemes, jugar conmigo eso te entretiene, me siento como el sol, baby déjame entrar, déjame sorprenderte, no seas mala, me tienes de meme, tú lo que eres es una abusadora, ve a buscarte una cerveza y deja el cora.
  Tú y yo, yo y tú nos llevamos bien, qué lo que, dame luz, yo sigo tus pies, a donde vayas te sigue la luna, la noche está buena, mi corazón es de arena, pero tú estás dejando tu huella, y enseí±ame a bailar, mami yo no sé, pero ya estoy borracho y son las 3, tú y yo solitos y el sol, portate mal, que nadie se va a enterar, no pares de bailar, si tú te tardas, te beso primero, ándale ponte el cuero, yo quiero ver contigo el amanecer, y enseí±ame a bailar, mami, yo no sé.
  Todaví­a yo te quiero, pero sé que es un error, porque ya tú no me quieres, y sin ti me va mejor, y si veo a tu mamá, yo le pregunto por ti, y es que estoy arrebatado, pensando en todas las veces que te lo metí­, no sé por qué diablo me engaí±o diciendo que te olvidé cuando te extraí±o, me botaron del trabajo por andar mirando pa abajo, pensando en cojer un atajo, al menos que seas tú, baby te quiero aunque digas lo contrario, hoy salí­ con los muchachos a beber, y dije que de ti no iba a hablar, son las 5 ya va a amanecer, si no prende la voy a llamar, todaví­a yo te quiero, pero sé que es un error, pa ver si ya tienes a alguien, alguien que te haga feliz.
  Quizá yo vuelva con mi ex y no te vuelva a ver, quizá no te importa, quizá te va a doler, esto es un ratito, mami no te acostumbres. que el amor es muy bonito, pero siempre hay algo que lo interrumpe, pa mi que yo nací­ pa estar solo, baby vamos a hacerlo otra vez, chingar otra vez, con cualquiera no me acuesto, me pongo feliz cuando llegan tus textos, o cuando en 4 te la meto, contigo me voy a todo, mi vida es complicada, tú no vas a entender, no hay una loca pa este loco.
  Todo parece estar bien, pero nada es lo que parece, lo intenté pero fracasé, y ahora dime cómo duermo si tú no me perteneces, quien menos te esperas se va y te traiciona, te di lo que pedí­as y no fue suficiente, tú solo mentí­as y yo tu fiel creyente, tú calladita chequeando mis mensajes, te fuiste de casa y sacaste tu equipaje, y ahora quiere que me quede tranquilo, me duele que le haya creí­do algo mí­o a otro cabrón, no quiero que nada te falte, yo no te deseo el mal, pero vas a pensar en mí­ cada vez que te levantes, yo fui tu cliente, siempre era yo el culpable, esa carita de inocente solo te la cree el resto de la gente, no pienso llamarte, te aclaro la duda, querí­as mi corazón y te lo puse en descuento, quédate con la culpa y también con la ropa cara.
  No quiero acostarme, no puedo dormir, no puedo acabar, no me puedo rendir, tantos recuerdos, logros que viví, razones me sobran para sobrevivir, no todo es como parece, no me creen, yo se los digo, vivo muy aprisa la vida de artista, drogas y mujeres, con figuras grandes, citas importantes, 20 mil como si nada, puras dieces son mis damas, desde antes de la fama, me arrestaron a los 15 años por querer lograr todos mis sueños, cuando me corrieron yo me sentí abandonado, son las cosas que uno va pensando rolando un cigarro, paseando por hollywood, adquiro lo que admiro, nuestra generación piensa diferente, poder absoluto, vive en puro lujo, pero yo seguiré avanzando.
  
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
