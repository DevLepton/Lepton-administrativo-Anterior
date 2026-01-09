import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewAccessoryModalComponent } from './view-accessory-modal.component';

describe('ViewAccessoryModalComponent', () => {
  let component: ViewAccessoryModalComponent;
  let fixture: ComponentFixture<ViewAccessoryModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewAccessoryModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewAccessoryModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
