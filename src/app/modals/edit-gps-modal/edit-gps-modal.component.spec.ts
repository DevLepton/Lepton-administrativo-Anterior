import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGpsModalComponent } from './edit-gps-modal.component';

describe('EditGpsModalComponent', () => {
  let component: EditGpsModalComponent;
  let fixture: ComponentFixture<EditGpsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditGpsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGpsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
