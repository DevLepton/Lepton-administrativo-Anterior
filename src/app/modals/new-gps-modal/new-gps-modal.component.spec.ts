import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewGpsModalComponent } from './new-gps-modal.component';

describe('NewGpsModalComponent', () => {
  let component: NewGpsModalComponent;
  let fixture: ComponentFixture<NewGpsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NewGpsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewGpsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
