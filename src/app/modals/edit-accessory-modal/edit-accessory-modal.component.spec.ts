import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditAccessoryModalComponent } from './edit-accessory-modal.component';

describe('EditAccessoryModalComponent', () => {
  let component: EditAccessoryModalComponent;
  let fixture: ComponentFixture<EditAccessoryModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditAccessoryModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditAccessoryModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
