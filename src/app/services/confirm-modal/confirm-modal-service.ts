import { Injectable } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {

  show = false;
  options: ConfirmOptions | null = null;

  private resolver!: (value: boolean) => void;

  open(options: ConfirmOptions): Promise<boolean> {
    this.options = options;
    this.show = true;

    return new Promise(resolve => {
      this.resolver = resolve;
    });
  }

  confirm() {
    this.show = false;
    this.resolver(true);
  }

  cancel() {
    this.show = false;
    this.resolver(false);
  }
}