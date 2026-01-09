import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessoriesTabComponent } from './accessories-tab.component';

describe('AccessoriesTabComponent', () => {
  let component: AccessoriesTabComponent;
  let fixture: ComponentFixture<AccessoriesTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccessoriesTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessoriesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
