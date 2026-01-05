import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewGpsModalComponent } from './view-gps-modal.component';

describe('ViewGpsModalComponent', () => {
  let component: ViewGpsModalComponent;
  let fixture: ComponentFixture<ViewGpsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewGpsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewGpsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
