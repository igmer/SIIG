$(document).ready(function () {
    var rowid;
    // Grid de criterios
    $("#jqGrid").jqGrid({
        url: Routing.generate('calidad_planmejora_get_criterios'),
        datatype: "json",
        colModel: [
            {label: 'ID', name: 'CustomerID', key: true, width: 75},
            {label: 'Company Name', name: 'CompanyName', width: 150},
            {label: 'Contact Name', name: 'ContactName', width: 150},
            {label: 'Phone', name: 'Phone', width: 150},
            {label: 'City', name: 'City', width: 150}
        ],
        autowidth: true,
        height: 150,
        rowNum: 7,
        viewrecords: true,
        loadonce: true,
        caption: 'Criterios',
        onSelectRow: function (rowid, selected) {
            if (rowid != null) {
                jQuery("#jqGridDetails").jqGrid('setGridParam', {url: Routing.generate('calidad_planmejora_get_actividades', {criterio: rowid}), datatype: 'json'}); // the last setting is for demo only
                jQuery("#jqGridDetails").jqGrid('setCaption', 'Actividades de criterio::' + rowid);
                jQuery("#jqGridDetails").trigger("reloadGrid");
            }
        }, // use the onSelectRow that is triggered on row click to show a details grid
        onSortCol: clearSelection,
        onPaging: clearSelection,
        pager: "#jqGridPager"
    });

    // grid de actividades
    $("#jqGridDetails").jqGrid({
        url: Routing.generate('calidad_planmejora_get_actividades', {criterio: 0}),
        datatype: "json",
        editurl: Routing.generate('calidad_planmejora_set_actividades', {criterio: rowid}),
        colModel: [
            {label: 'Nombre de actividad', name: 'nombre', key: true, width: 100, editable: true, edittype: 'textarea', editrules: {required: true}},
            {label: 'Fecha inicio', name: 'fechaInicio', width: 30, editable: true, editrules: {required: true},
                edittype:"text",
                editoptions: {
                    dataInit: function (element) {
                        $(element).datepicker({
                            id: 'fechaInicio_datePicker',
                            datefmt: 'd/m/yy',
                            showOn: 'focus'
                        });
                    }
                }
            },
            {label: 'Fecha fin', name: 'fechaFinalizacion', width: 30, editable: true, editrules: {required: true},
                edittype:"text",
                editoptions: {
                    dataInit: function (element) {
                        $(element).datepicker({
                            id: 'fechaFin_datePicker',
                            datefmt: 'd/m/yy',
                            showOn: 'focus'
                        });
                    }
                }
            },
            {label: 'Medio de verificación', name: 'medioVerificacion', width: 100, editable: true, edittype: 'textarea', editrules: {required: true}},
            {label: 'Responsable', name: 'responsable', width: 75, editable: true, edittype: 'textarea', editrules: {required: true}},
            {label: '% de avance', name: 'porcentajeAvance', width: 20, editable: true, editrules: {required: true, integer: true, minValue:0, maxValue:100}}
        ],
        autowidth: true,
        loadonce: true,
        height: '100',
        viewrecords: true,
        caption: 'Actividades::',
        pager: "#jqGridDetailsPager"
    });

    $('#jqGridDetails').navGrid('#jqGridDetailsPager',
        // the buttons to appear on the toolbar of the grid
        {edit: true, add: true, del: true, search: true, refresh: false, view: false, position: "left", cloneToTop: false},
        
        // options for the Edit Dialog
        {
            editCaption: "Editar actividad",
            recreateForm: true,
            checkOnUpdate: true,
            checkOnSubmit: true,
            closeAfterEdit: true,
            errorTextFormat: function (data) {
                return 'Error: ' + data.responseText
            }
        },
        // options for the Add Dialog
        {
            closeAfterAdd: true,
            recreateForm: true,
            errorTextFormat: function (data) {
                return 'Error: ' + data.responseText
            }
        },
        // options for the Delete Dailog
        {
            errorTextFormat: function (data) {
                return 'Error: ' + data.responseText
        }
    });
    
    
});

function clearSelection() {
    jQuery("#jqGridDetails").jqGrid('setGridParam', {url: Routing.generate('calidad_planmejora_get_actividades', {criterio: 0}), datatype: 'json'}); // the last setting is for demo purpose only
    jQuery("#jqGridDetails").jqGrid('setCaption', 'Actividades:: ');
    jQuery("#jqGridDetails").trigger("reloadGrid");

}
