import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';


@Injectable({
    providedIn: 'root'
})
export class ExportExcelService {

    exportClients(data: any) {

        const {
            allClients,
            activeClients,
            excludedAccounts,
            selected,
            totalClientes,
            filteredClientsList,
            totalTrackers,
            totalOnline,
            totalOffline,
            totalSuspended,
            totalHidden,
            offlineBuckets
        } = data;

        const ws = XLSX.utils.aoa_to_sheet([]);

        const now = new Date().toLocaleString();

        XLSX.utils.sheet_add_aoa(ws, [[`Fecha: ${now}`]], {
            origin: { r: 0, c: 0 }
        });

        const totalNoUse = filteredClientsList.filter((c: any) =>
            c.trackers?.length > 0 &&
            c.ultimoIngreso === 'Sin uso en el último mes'
        ).length;

        const kpis = [
            ['Clientes:', totalClientes],
            ['Clientes sin usar la plataforma:', totalNoUse],
            ['Número de Dispositivos:', totalTrackers],
            ['Dispositivos Online:', totalOnline],
            ['Dispositivos Offline:', totalOffline],
            ['Porcentaje Online:', `${Math.round((totalOnline / (totalTrackers || 1)) * 100)}%`],
            ['Dispositivos Suspendidos:', totalSuspended],
            ['Dispositivos Hidden:', totalHidden],
            ['', ''],
            ['GPS Offline + 12H:', offlineBuckets.find((b: any) => b.label === '+12H')?.value || 0],
            ['GPS Offline + 1D:', offlineBuckets.find((b: any) => b.label === '+1D')?.value || 0],
            ['GPS Offline + 15D:', offlineBuckets.find((b: any) => b.label === '+15D')?.value || 0],
            ['GPS Offline + 1M:', offlineBuckets.find((b: any) => b.label === '+1M')?.value || 0],
            ['GPS Offline + 6M:', offlineBuckets.find((b: any) => b.label === '+6M')?.value || 0],
            ['GPS Offline + 1A:', offlineBuckets.find((b: any) => b.label === '+1A')?.value || 0],
            ['GPS Offline + 2A:', offlineBuckets.find((b: any) => b.label === '+2A')?.value || 0],
            ['GPS Offline + 3A:', offlineBuckets.find((b: any) => b.label === '+3A')?.value || 0],
            ['GPS Offline + 4A:', offlineBuckets.find((b: any) => b.label === '+4A')?.value || 0],
            ['GPS Offline + 5A:', offlineBuckets.find((b: any) => b.label === '+5A')?.value || 0],
        ];


        XLSX.utils.sheet_add_aoa(ws, kpis, { origin: { r: 2, c: 0 } });

        let currentRow = 0;
        const startCol = 3; // desplazamiento a la derecha

        selected.forEach((cliente: any) => {

            const headers = [
                `${cliente.id}`,
                `${cliente.nombre}`,
                `${cliente.login}`,
                `${cliente.ciudad || '-'}`,
                `${cliente.trackers?.length || 0}`,
                'Nombre en plataforma',
                'IMEI',
                'SIM',
                'Plan',
                'Modelo GPS',
                'Clon',
                'Suspendido',
                'Hidden',
                'SDC1',
                'SDC2',
                'SDC Acumulado',
                'CAN Bus',
                'Última Conexión UTC',
                'Última Conexión Tepic',
                'Tiempo Offline',
                'Status Soporte',
                'Último ingreso'
            ];

            const headerRow = currentRow; // guarda la fila

            XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: headerRow, c: startCol } });

            headers.forEach((_, i) => {
                const ref = XLSX.utils.encode_cell({ r: headerRow, c: startCol + i });

                if (ws[ref]) {
                    ws[ref].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "EAEAEA" } },
                        alignment: { horizontal: "center" }
                    };
                }
            });

            currentRow++;

            // 🔽 TRACKERS
            cliente.trackers?.forEach((t: any, index: number) => {
                XLSX.utils.sheet_add_aoa(ws, [[
                    '',
                    '',
                    '',
                    '',
                    '',
                    t.nombre,
                    t.imei,
                    t.sim,
                    t.plan,
                    t.modelo,
                    t.clon ? 'TRUE' : 'FALSE',
                    t.suspendido ? 'TRUE' : 'FALSE',
                    t.hidden ? 'TRUE' : 'FALSE',
                    t.sdc1 || '',
                    t.sdc2 || '',
                    t.sdcAcumulado || '',
                    t.canbus || '',
                    t.ultimaConexionUTC,
                    t.ultimaConexionLocal,
                    t.tiempoOffline,
                    t.statusSoporte,
                    index === 0 ? (cliente.ultimoIngreso || '') : ''
                ]], { origin: { r: currentRow, c: startCol } });

                currentRow++;
            });

            currentRow += 2;
        });

        const range = XLSX.utils.decode_range(ws['!ref'] || '');

        for (let R = 0; R <= range.e.r; ++R) {
            for (let C = 0; C <= range.e.c; ++C) {

                const ref = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[ref];

                if (!cell || !cell.v) continue;

                const value = String(cell.v);

                // KPI labels
                if (C === 0 && value.includes(':')) {
                    ws[ref].s = { font: { bold: true } };
                }

                // Fecha
                if (value.includes('Fecha:')) {
                    ws[ref].s = { font: { bold: true } };
                }
            }
        }

        ws['!cols'] = [
            { wch: 30 }, // KPI label
            { wch: 10 }, // KPI value
            { wch: 10 }, // espacio
            { wch: 11 },
            { wch: 43 },
            { wch: 27 },
            { wch: 17 },
            { wch: 13 },
            { wch: 50 },
            { wch: 18 },
            { wch: 15 },
            { wch: 17 },
            { wch: 17 },
            { wch: 10 },
            { wch: 15 },
            { wch: 11 },
            { wch: 13 },
            { wch: 13 },
            { wch: 13 },
            { wch: 13 },
            { wch: 28 },
            { wch: 28 },
            { wch: 40 },
            { wch: 22 },
            { wch: 55 }
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet([]);

        // Fecha
        XLSX.utils.sheet_add_aoa(wsResumen, [
            ['Fecha:', now]
        ], {
            origin: { r: 0, c: 0 }
        });

        // Total clientes
        XLSX.utils.sheet_add_aoa(wsResumen, [
            ['Total clientes:', allClients.length]
        ], {
            origin: { r: 1, c: 0 }
        });

        // Encabezados lista clientes (empieza en columna D)
        const headersResumen = [
            'ID',
            'Nombre',
            'Correo',
            'Ciudad',
            'Cantidad de dispositivos'
        ];

        XLSX.utils.sheet_add_aoa(wsResumen, [headersResumen], {
            origin: { r: 0, c: 3 }
        });

        // Estilos encabezados
        headersResumen.forEach((_, i) => {
            const ref = XLSX.utils.encode_cell({ r: 0, c: 3 + i });

            if (wsResumen[ref]) {
                wsResumen[ref].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "EAEAEA" } },
                    alignment: { horizontal: "center" }
                };
            }
        });

        // Datos clientes (fila 2)
        const rowsResumen = allClients.map((c: any) => [
            c.id,
            c.nombre,
            c.login,
            c.ciudad || '-',
            c.trackers?.length || 0
        ]);

        XLSX.utils.sheet_add_aoa(wsResumen, rowsResumen, {
            origin: { r: 1, c: 3 }
        });

        // Negritas labels izquierda
        ['A1', 'A2'].forEach(ref => {
            if (wsResumen[ref]) {
                wsResumen[ref].s = {
                    font: { bold: true }
                };
            }
        });

        // Anchos columnas
        wsResumen['!cols'] = [
            { wch: 18 }, // A
            { wch: 25 }, // B
            { wch: 10 },  // C separador
            { wch: 12 }, // D
            { wch: 40 }, // E
            { wch: 35 }, // F
            { wch: 25 }, // G
            { wch: 22 }  // H
        ];

        const wsConDispositivos = XLSX.utils.aoa_to_sheet([]);

        // Filtrar clientes con al menos un dispositivo
        const clientsWithDevices = allClients.filter((c: any) => {
            const hasDevices = (c.trackers?.length || 0) > 0;
            const isActive = !!activeClients[String(c.id)];
            const isExcluded = excludedAccounts.includes(c.id);

            return hasDevices && isActive && !isExcluded;
        });

        // Fecha
        XLSX.utils.sheet_add_aoa(wsConDispositivos, [
            ['Fecha:', now]
        ], {
            origin: { r: 0, c: 0 }
        });

        // Total clientes
        XLSX.utils.sheet_add_aoa(wsConDispositivos, [
            ['Total clientes:', clientsWithDevices.length]
        ], {
            origin: { r: 1, c: 0 }
        });

        // Encabezados desde columna D
        const headersDevices = [
            'ID',
            'Nombre',
            'Correo',
            'Ciudad',
            'Cantidad de dispositivos',
            'Último inicio de sesión'
        ];

        XLSX.utils.sheet_add_aoa(wsConDispositivos, [headersDevices], {
            origin: { r: 0, c: 3 }
        });

        // Estilos encabezados
        headersDevices.forEach((_, i) => {
            const ref = XLSX.utils.encode_cell({ r: 0, c: 3 + i });

            if (wsConDispositivos[ref]) {
                wsConDispositivos[ref].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "EAEAEA" } },
                    alignment: { horizontal: "center" }
                };
            }
        });

        // Datos
        const rowsDevices = clientsWithDevices.map((c: any) => [
            c.id,
            c.nombre,
            c.login,
            c.ciudad || '-',
            c.trackers?.length || 0,
            c.ultimoIngreso || '-'
        ]);

        XLSX.utils.sheet_add_aoa(wsConDispositivos, rowsDevices, {
            origin: { r: 1, c: 3 }
        });

        // Negritas lado izquierdo
        ['A1', 'A2'].forEach(ref => {
            if (wsConDispositivos[ref]) {
                wsConDispositivos[ref].s = {
                    font: { bold: true }
                };
            }
        });

        // Anchos columnas
        wsConDispositivos['!cols'] = [
            { wch: 18 },
            { wch: 25 },
            { wch: 5 },
            { wch: 12 },
            { wch: 40 },
            { wch: 35 },
            { wch: 25 },
            { wch: 22 },
            { wch: 55 }
        ];


        const wsOffline = XLSX.utils.aoa_to_sheet([]);

        // Fecha
        XLSX.utils.sheet_add_aoa(wsOffline, [
            ['Fecha: ' + now, '']
        ], {
            origin: { r: 0, c: 0 }
        });

        const offlineClients = allClients
            .filter((c: any) => {
                const isActive = !!activeClients[String(c.id)];
                const isExcluded = excludedAccounts.includes(c.id);

                return isActive && !isExcluded;
            })
            .map((c: any) => {
                const offlineTrackers = (c.trackers || []).filter((t: any) =>
                    t.minutosOffline >= 720
                );

                return {
                    ...c,
                    trackers: offlineTrackers
                };
            })
            .filter((c: any) => c.trackers.length > 0);

        // Total clientes
        XLSX.utils.sheet_add_aoa(wsOffline, [
            ['Total clientes:', offlineClients.length]
        ], {
            origin: { r: 2, c: 0 }
        });

        // estilos izquierda
        ['A1', 'A3'].forEach(ref => {
            if (wsOffline[ref]) {
                wsOffline[ref].s = {
                    font: { bold: true }
                };
            }
        });

        let currentRowOffline = 0;
        const startColOffline = 3; // empieza igual que Detalle Clientes

        offlineClients.forEach((cliente: any) => {

            const headers = [
                `${cliente.id}`,
                `${cliente.nombre}`,
                `${cliente.login}`,
                `${cliente.ciudad || '-'}`,
                `${cliente.trackers?.length || 0}`,
                'Nombre en plataforma',
                'IMEI',
                'SIM',
                'Plan',
                'Modelo GPS',
                'Clon',
                'Suspendido',
                'Hidden',
                'SDC1',
                'SDC2',
                'SDC Acumulado',
                'CAN Bus',
                'Última Conexión UTC',
                'Última Conexión Tepic',
                'Tiempo Offline',
                'Status Soporte',
                'Último ingreso'
            ];

            const headerRow = currentRowOffline;

            XLSX.utils.sheet_add_aoa(wsOffline, [headers], {
                origin: { r: headerRow, c: startColOffline }
            });

            // estilos encabezados
            headers.forEach((_, i) => {
                const ref = XLSX.utils.encode_cell({
                    r: headerRow,
                    c: startColOffline + i
                });

                if (wsOffline[ref]) {
                    wsOffline[ref].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "EAEAEA" } },
                        alignment: { horizontal: "center" }
                    };
                }
            });

            currentRowOffline++;

            cliente.trackers.forEach((t: any, index: number) => {

                XLSX.utils.sheet_add_aoa(wsOffline, [[
                    '',
                    '',
                    '',
                    '',
                    '',
                    t.nombre,
                    t.imei,
                    t.sim,
                    t.plan,
                    t.modelo,
                    t.clon ? 'TRUE' : 'FALSE',
                    t.suspendido ? 'TRUE' : 'FALSE',
                    t.hidden ? 'TRUE' : 'FALSE',
                    t.sdc1 || '',
                    t.sdc2 || '',
                    t.sdcAcumulado || '',
                    t.canbus || '',
                    t.ultimaConexionUTC,
                    t.ultimaConexionLocal,
                    t.tiempoOffline,
                    t.statusSoporte,
                    index === 0 ? (cliente.ultimoIngreso || '') : ''
                ]], {
                    origin: { r: currentRowOffline, c: startColOffline }
                });

                currentRowOffline++;
            });

            currentRowOffline += 2;
        });

        // mismos anchos
        wsOffline['!cols'] = [...ws['!cols']];

        // EXPORTAR
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Clientes');
        XLSX.utils.book_append_sheet(wb, wsConDispositivos, 'Clientes con Dispositivos');
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Clientes');
        XLSX.utils.book_append_sheet(wb, wsOffline, 'Clientes Offline');

        const buffer = XLSX.write(wb, {
            bookType: 'xlsx',
            type: 'array',
            cellStyles: true
        });

        const blob = new Blob([buffer], {
            type: 'application/octet-stream'
        });

        const nowDate = new Date();

        const year = nowDate.getFullYear();
        const month = String(nowDate.getMonth() + 1).padStart(2, '0');
        const day = String(nowDate.getDate()).padStart(2, '0');

        const fileName = `Detalles Clientes ${year} ${month} ${day}.xlsx`;

        saveAs(blob, fileName);
    }

}