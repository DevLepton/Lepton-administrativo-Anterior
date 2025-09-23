import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewSimModalComponent } from './new-sim-modal.component';

describe('NewSimModalComponent', () => {
  let component: NewSimModalComponent;
  let fixture: ComponentFixture<NewSimModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NewSimModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewSimModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
