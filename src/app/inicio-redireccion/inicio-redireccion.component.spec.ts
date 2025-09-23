import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InicioRedireccionComponent } from './inicio-redireccion.component';

describe('InicioRedireccionComponent', () => {
  let component: InicioRedireccionComponent;
  let fixture: ComponentFixture<InicioRedireccionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InicioRedireccionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InicioRedireccionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
