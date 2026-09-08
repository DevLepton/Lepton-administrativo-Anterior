import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuoteItem } from '../services/api.service';

interface QuotePdfLine {
    amount: number;
    name: string;
    concept: string;
    description: string;
    unitPrice: number;
    discount: number;
    discountPercent: number;
    import: number;
}

interface QuotePdfTotals {
    subtotal?: number;
    discounts: number;
    IVA?: number;
    total: number;
    paymentNextMonthly?: number;
}

@Injectable({ providedIn: 'root' })
export class CotizacionesPdfService {

    loadLogo(): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = '/assets/logo vect color negro_iconos para routes.png';
        });
    }

    buildPdfLines(quote: QuoteItem): QuotePdfLine[] {
        return quote.products.map(product => {
            const amount = Math.max(1, Number(product.amount || 1));
            const unitPrice = quote.billable ? Number(product.price || 0) : Number(product.priceIVA || 0);
            const gross = unitPrice * amount;
            const discount = product.discountType === '%'
                ? gross * (Math.min(Number(product.discount || 0), 100) / 100)
                : Math.min(Number(product.discount || 0), gross);

            const discountPercent = Math.min(100, Math.max(0, Number(product.discount || 0)));

            return {
                amount,
                name: product.name || 'Producto',
                concept: product.concept || 'Producto',
                description: product.description || '',
                unitPrice: this.roundMoney(unitPrice),
                discount: this.roundMoney(discount),
                discountPercent: this.roundMoney(discountPercent),
                import: this.roundMoney(Math.max(0, gross - discount))
            };
        });
    }

    money(value: number): string {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
    }

    roundMoney(value: number): number {
        return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    }

    private buildPdfTotals(quote: QuoteItem, rows: QuotePdfLine[]): QuotePdfTotals {
        const subtotal = this.roundMoney(rows.reduce((sum, row) => sum + (row.unitPrice * row.amount), 0));
        const discounts = this.roundMoney(rows.reduce((sum, row) => sum + row.discount, 0));
        const taxableBase = this.roundMoney(subtotal - discounts);
        const IVA = quote.billable ? this.roundMoney(taxableBase * 0.16) : undefined;
        const total = quote.billable ? Math.trunc(taxableBase + (IVA ?? 0)) : taxableBase;

        return {
            subtotal: quote.billable ? subtotal : undefined,
            discounts,
            IVA,
            total,
            paymentNextMonthly: quote.paymentNextMonthly != null ? Number(quote.paymentNextMonthly) : undefined
        };
    }

    drawQuoteHeader(doc: jsPDF, quote: QuoteItem, page: number, logo: HTMLImageElement): void {
        const width = doc.internal.pageSize.getWidth();
        const margin = 14;

        const issueDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
        const validity = quote.validity ? new Date(quote.validity) : null;
        const units = quote.units ?? 1;

        // Logo
        doc.addImage(logo, 'PNG', margin - 2, 14, 53, 18);

        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(page === 1 ? 18 : 16);
        doc.setTextColor(34, 34, 34);
        doc.text('Cotización', width - margin, 18, { align: 'right' });

        // Folio y fechas — todas las páginas
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        doc.text(`Folio: ${quote.quoteNum || '-'}`, width - margin, 25, { align: 'right' });

        doc.text(`Fecha de emisión: ${this.formatDate(issueDate)}`, width - margin, 29, { align: 'right' });

        doc.text(`Vencimiento: ${validity ? this.formatDate(validity) : '-'}`, width - margin, 33, { align: 'right' });

        // Información del cliente — solamente primera página
        if (page === 1) {
            const dataY = 42;

            doc.setFontSize(9);
            doc.setTextColor(34, 34, 34);

            doc.setFont('helvetica', 'bold');
            doc.text('Cliente:', margin, dataY);

            let x = margin + doc.getTextWidth('Cliente:') + 1.5;

            doc.setFont('helvetica', 'normal');
            doc.text(quote.clientName || '-', x, dataY);

            doc.setFont('helvetica', 'bold');
            doc.text('Empresa:', margin, dataY + 5);

            x = margin + doc.getTextWidth('Empresa:') + 1.5;

            doc.setFont('helvetica', 'normal');
            doc.text(quote.companyName || '-', x, dataY + 5);

            doc.setFont('helvetica', 'bold');
            doc.text('Lugar:', margin, dataY + 10);

            x = margin + doc.getTextWidth('Lugar:') + 1.5;

            doc.setFont('helvetica', 'normal');
            doc.text(quote.place || '-', x, dataY + 10);

            const unitsLabel = 'Unidades:';
            const unitsValue = String(units);
            const unitsGap = 1.5;

            doc.setFont('helvetica', 'bold');
            const unitsLabelWidth = doc.getTextWidth(unitsLabel);

            doc.setFont('helvetica', 'normal');
            const unitsValueWidth = doc.getTextWidth(unitsValue);

            let x2 = width - margin - unitsLabelWidth - unitsGap - unitsValueWidth;

            doc.setFont('helvetica', 'bold');
            doc.text(unitsLabel, x2, dataY);

            doc.setFont('helvetica', 'normal');
            doc.text(unitsValue, x2 + unitsLabelWidth + unitsGap, dataY);

            const modelLabel = 'Modelo:';
            const modelValue = quote.model || 'Sin modelo/tipo';

            doc.setFont('helvetica', 'bold');
            const modelLabelWidth = doc.getTextWidth(modelLabel);

            doc.setFont('helvetica', 'normal');
            const modelValueWidth = doc.getTextWidth(modelValue);

            x2 = width - margin - modelLabelWidth - unitsGap - modelValueWidth;

            doc.setFont('helvetica', 'bold');
            doc.text(modelLabel, x2, dataY + 5);

            doc.setFont('helvetica', 'normal');
            doc.text(modelValue, x2 + modelLabelWidth + unitsGap, dataY + 5);
        }
    }

    async createQuotePdf(quote: QuoteItem): Promise<jsPDF> {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const logo = await this.loadLogo();
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const rows = this.buildPdfLines(quote);
        const totals = this.buildPdfTotals(quote, rows);
        let tableFinalY = 0;

        autoTable(doc, {
            startY: 60,
            margin: { top: 65, right: margin, bottom: 35, left: margin },
            rowPageBreak: 'avoid',
            head: [['Cant.', 'Descripción', 'Precio unitario', 'Descuento', '', 'Importe']],
            body: rows.map(row => [
                String(row.amount),
                `${row.concept}${row.description ? `\n${row.description}` : ''}`,
                this.money(row.unitPrice),
                row.discount > 0 ? this.money(row.discount) : '',
                row.discountPercent > 0 ? `${row.discountPercent}%` : '',
                this.money(row.import)
            ]),
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 8.5,
                textColor: [34, 34, 34],
                cellPadding: { top: 3, right: 2, bottom: 4, left: 2 },
                // lineColor: [220, 220, 220],
                lineWidth: 0,
                valign: 'top',
            },
            headStyles: {
                fontStyle: 'bold',
                textColor: [34, 34, 34],
                lineColor: [220, 220, 220],
                lineWidth: { bottom: 0.2 },
                fillColor: [255, 255, 255]
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' }, // Cant.
                1: { cellWidth: 'auto' },               // Descripción
                2: { cellWidth: 25, halign: 'right' },  // Precio unitario
                3: { cellWidth: 25, halign: 'right' },  // Descuento $
                4: { cellWidth: 14, halign: 'right' },  // Descuento %
                5: { cellWidth: 26, halign: 'right' }   // Importe
            },
            didParseCell: data => {
                if (data.section === 'head' && data.column.index >= 2) {
                    data.cell.styles.halign = 'right';
                }

                if (data.section !== 'body' || data.column.index !== 1) return;

                const row = rows[data.row.index];
                if (!row) return;

                /*
                 * Ancho real disponible para Descripción.
                 *
                 * Página carta = 215.9 mm
                 * Márgenes = 14 + 14
                 * Columnas fijas:
                 * Cant.          12
                 * Precio         25
                 * Descuento $    25
                 * Descuento %    14
                 * Importe        26
                 */
                const descriptionWidth = pageWidth - (margin * 2) - 12 - 25 - 25 - 14 - 26;

                const paddingX = 2;
                const maxWidth = descriptionWidth - (paddingX * 2);

                // Nombre
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);

                const nameLines = doc.splitTextToSize(row.concept, maxWidth);

                // Descripción
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);

                const descriptionLines = row.description
                    ? doc.splitTextToSize(row.description, maxWidth)
                    : [];

                /*
                 * AutoTable usa estas líneas únicamente para calcular
                 * correctamente la altura de la fila.
                 */
                data.cell.text = [...nameLines, ...descriptionLines];

                data.cell.styles.fontSize = 7;
            },
            willDrawCell: data => {
                if (data.section !== 'body' || data.column.index !== 1) return;

                const row = rows[data.row.index];
                if (!row) return;

                const cell = data.cell;

                const paddingLeft = 2;
                const paddingTop = 3;

                const nameLineHeight = 3.5;
                const descriptionLineHeight = 2.9;

                const x = cell.x + paddingLeft;
                let y = cell.y + paddingTop + 2.8;

                const descriptionWidth = pageWidth - (margin * 2) - 12 - 25 - 25 - 14 - 26;
                const maxWidth = descriptionWidth - (paddingLeft * 2);

                // Nombre
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(34, 34, 34);

                const nameLines = doc.splitTextToSize(row.concept, maxWidth);

                doc.text(nameLines, x, y - 0.4);

                y += nameLines.length * nameLineHeight;

                // Descripción
                if (row.description) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);

                    const descriptionLines = doc.splitTextToSize(row.description, maxWidth);

                    doc.text(descriptionLines, x, y, { lineHeightFactor: descriptionLineHeight / 2.469 });
                }

                // Evitar que AutoTable dibuje el texto nuevamente
                data.cell.text = [];
            },
            didDrawCell: data => {
                if (data.section !== 'body' || data.column.index !== 0) return;

                const yBottom = data.cell.y + data.cell.height;

                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);

                doc.line(margin, yBottom, pageWidth - margin, yBottom);
            },
            didDrawPage: data => {
                this.drawQuoteHeader(doc, quote, data.pageNumber, logo);
            }
        });

        tableFinalY = (doc as any).lastAutoTable?.finalY ?? 78;

        const requiredHeight = 82;
        if (tableFinalY + requiredHeight > pageHeight - 18) {
            doc.addPage();
            this.drawQuoteHeader(doc, quote, doc.getNumberOfPages(), logo);
            tableFinalY = 40;
        }

        let y = tableFinalY + 7;
        y = this.drawPdfTotals(doc, quote, totals, y, pageWidth, pageHeight);
        y = y + 10;
        y = this.drawPdfPayment(doc, quote, y, pageWidth, pageHeight, logo);
        this.drawPdfTerms(doc, y + 5, pageWidth, pageHeight, logo);

        this.drawPageNumbers(doc);

        return doc;
    }

    private drawPageNumbers(doc: jsPDF): void {
        const totalPages = doc.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        for (let page = 1; page <= totalPages; page++) {
            doc.setPage(page);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(104, 104, 104);

            doc.text(
                `Página ${page} de ${totalPages}`,
                pageWidth / 2,
                pageHeight - 9,
                { align: 'center' }
            );
        }
    }

    private drawPdfTotals(doc: jsPDF, quote: QuoteItem, totals: QuotePdfTotals, startY: number, width: number, height: number): number {
        let y = startY;
        const labelX = width - 47;
        const valueX = width - 16;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(34, 34, 34);

        if (quote.billable && totals.subtotal != null) {
            doc.text('Subtotal:', labelX, y, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(this.money(totals.subtotal), valueX, y, { align: 'right' });
            y += 5.5;
        }

        doc.setFont('helvetica', 'bold');
        doc.text('Descuentos:', labelX, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(this.money(totals.discounts), valueX, y, { align: 'right' });

        if (quote.billable && totals.IVA != null) {
            y += 5.5;
            doc.setFont('helvetica', 'bold');
            doc.text('IVA 16%:', labelX, y, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(this.money(totals.IVA), valueX, y, { align: 'right' });
        }

        y += 4;
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(labelX - 20, y, valueX, y);
        y += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text('Total:', labelX, y, { align: 'right' });
        doc.text(this.money(totals.total), valueX, y, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        const amountWords = this.amountToWords(totals.total);

        const totalLabel = 'Total:';
        const totalLabelWidth = doc.getTextWidth(totalLabel);
        const wordsGap = 13;

        doc.text(amountWords, labelX - totalLabelWidth - wordsGap, y, { align: 'right' });
        y += 11;

        // if (totals.paymentNextMonthly != null && totals.paymentNextMonthly > 0) {
        //     doc.setFontSize(9);
        //     doc.text('Pago próxima mensualidad:', labelX, y, { align: 'right' });
        //     doc.setFont('helvetica', 'normal');
        //     doc.text(this.money(totals.paymentNextMonthly), valueX, y, { align: 'right' });
        //     y += 5;
        // }

        if (totals.paymentNextMonthly != null && totals.paymentNextMonthly > 0) {
            doc.setFontSize(9);

            const paymentLabel = 'Pago próxima mensualidad:';
            const paymentValue = this.money(totals.paymentNextMonthly);

            // Medir exactamente los textos que ya se van a dibujar
            doc.setFont('helvetica', 'bold');
            const labelWidth = doc.getTextWidth(paymentLabel);

            doc.setFont('helvetica', 'normal');
            const valueWidth = doc.getTextWidth(paymentValue);

            const paddingX = 4;
            const paddingY = 3;

            // Límites exactos de los textos actuales
            const textLeft = labelX - labelWidth;
            const textRight = valueX;

            const boxX = textLeft - paddingX;
            const boxY = y - doc.getFontSize() * 0.3528 - paddingY;
            const boxWidth = (textRight - textLeft) + paddingX * 2;
            const boxHeight = doc.getFontSize() * 0.3528 + paddingY * 2 + 1;

            // Recuadro azul detrás del texto
            // doc.setFillColor(37, 99, 235);
            // doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');

            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(0.5);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'S');

            // Texto original, en las mismas posiciones
            // doc.setTextColor(255, 255, 255);

            doc.setFont('helvetica', 'bold');
            doc.text(paymentLabel, labelX, y, { align: 'right' });
            doc.text(paymentValue, valueX, y, { align: 'right' });

            // Restaurar color
            // doc.setTextColor(34, 34, 34);

            y += 5;
        }

        return y;
    }

    private drawPdfPayment(doc: jsPDF, quote: QuoteItem, startY: number, width: number, height: number, logo: HTMLImageElement): number {
        let y = startY;
        const margin = 14;

        if (y > height - 52) {
            doc.addPage();
            this.drawQuoteHeader(doc, quote, doc.getNumberOfPages(), logo);
            y = 38;
        }

        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.line(margin, y, width - margin, y);
        y += 7;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(34, 34, 34);
        doc.text('Método de pago', margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.text(`Titular: ${quote.paymentMethodHolder || '-'}`, margin, y + 7);
        doc.text(`Banco: ${quote.bankName || '-'}`, margin, y + 11);
        doc.text(`Cuenta: ${quote.accountNumber || '-'}`, margin + 75, y + 7);
        doc.text(`CLABE: ${quote.CLABE || '-'}`, margin + 75, y + 11);
        doc.setFontSize(7.5);
        // doc.text(`Facturable: ${quote.billable ? 'Si' : 'No'}`, width - margin, y, { align: 'right' });

        if (quote.comments) {
            const commentLines = doc.splitTextToSize(`Comentarios: ${quote.comments}`, width - (margin * 2));
            doc.text(commentLines, margin, y + 21);
            y += 21 + (commentLines.length * 3.5);
        } else {
            y += 19;
        }

        return y;
    }

    private drawPdfTerms(doc: jsPDF, startY: number, width: number, height: number, logo: HTMLImageElement): void {
        const margin = 14;
        let y = startY - 5;

        if (y > height - 47) {
            doc.addPage();
            this.drawQuoteHeader(doc, {} as QuoteItem, doc.getNumberOfPages(), logo);
            y = 42;
        }

        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.line(margin, y, width - margin, y);
        y += 6;

        const commentLines = [
            'Gracias por confiar en Leptón, Seguridad y Confianza en Movimiento.'
        ];

        const address = [
            'Av. de la Cultura #25, Ciudad del Valle',
            'Tel.: (311) 456 4344 / (55) 4440 0609',
            'ventas@lepton-seguridad.com',
            'C.P. 63157 Tepic, Nay.'
        ];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(34, 34, 34);
        doc.text('Comentarios', margin, y);
        doc.text('Domicilio Leptón', width - margin, y, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        y += 5;

        commentLines.forEach(line => {
            const lines = doc.splitTextToSize(line, 105);
            doc.text(lines, margin, y);
            y += lines.length * 3.2;
        });

        let addressY = y - (commentLines.length * 3.2) - 1;
        address.forEach(line => {
            doc.text(line, width - margin, addressY, { align: 'right' });
            addressY += 3.2;
        });
    }

    private formatDate(value: Date): string {
        return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
    }

    private amountToWords(value: number): string {
        const pesos = Math.floor(Number(value || 0));
        const cents = Math.round((Number(value || 0) - pesos) * 100);
        return `${this.numberToSpanish(pesos).toUpperCase()} PESOS ${String(cents).padStart(2, '0')}/100 MXN`;
    }

    private numberToSpanish(value: number): string {
        const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
        const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

        if (value < 20) return units[value];
        if (value < 30) return value === 20 ? 'veinte' : `veinti${units[value - 20]}`;
        if (value < 100) return value % 10 === 0 ? tens[Math.floor(value / 10)] : `${tens[Math.floor(value / 10)]} y ${units[value % 10]}`;
        if (value === 100) return 'cien';
        if (value < 1000) return value % 100 === 0 ? hundreds[Math.floor(value / 100)] : `${hundreds[Math.floor(value / 100)]} ${this.numberToSpanish(value % 100)}`;
        if (value < 2000) return value === 1000 ? 'mil' : `mil ${this.numberToSpanish(value % 1000)}`;
        if (value < 1000000) {
            const thousands = Math.floor(value / 1000);
            const rest = value % 1000;
            return rest === 0 ? `${this.numberToSpanish(thousands)} mil` : `${this.numberToSpanish(thousands)} mil ${this.numberToSpanish(rest)}`;
        }

        const millions = Math.floor(value / 1000000);
        const rest = value % 1000000;
        const millionText = millions === 1 ? 'un millon' : `${this.numberToSpanish(millions)} millones`;
        return rest === 0 ? millionText : `${millionText} ${this.numberToSpanish(rest)}`;
    }
}