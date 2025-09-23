import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewSimModalComponent } from './view-sim-modal.component';

describe('ViewSimModalComponent', () => {
  let component: ViewSimModalComponent;
  let fixture: ComponentFixture<ViewSimModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewSimModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewSimModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
