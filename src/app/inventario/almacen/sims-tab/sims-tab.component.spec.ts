import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimsTabComponent } from './sims-tab.component';

describe('SimsTabComponent', () => {
  let component: SimsTabComponent;
  let fixture: ComponentFixture<SimsTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SimsTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
