import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDeleteUserModalComponent } from './confirm-delete-user-modal.component';

describe('ConfirmDeleteUserModalComponent', () => {
  let component: ConfirmDeleteUserModalComponent;
  let fixture: ComponentFixture<ConfirmDeleteUserModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmDeleteUserModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmDeleteUserModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
