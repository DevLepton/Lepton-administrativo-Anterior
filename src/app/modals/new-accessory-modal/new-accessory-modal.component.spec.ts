import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewAccessoryModalComponent } from './new-accessory-modal.component';

describe('NewAccessoryModalComponent', () => {
  let component: NewAccessoryModalComponent;
  let fixture: ComponentFixture<NewAccessoryModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NewAccessoryModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewAccessoryModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
