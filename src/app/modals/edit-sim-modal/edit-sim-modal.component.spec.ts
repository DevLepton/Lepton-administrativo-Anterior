import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSimModalComponent } from './edit-sim-modal.component';

describe('EditSimModalComponent', () => {
  let component: EditSimModalComponent;
  let fixture: ComponentFixture<EditSimModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditSimModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditSimModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
