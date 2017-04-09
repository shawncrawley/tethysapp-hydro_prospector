from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from tethys_sdk.gizmos import TableView, TextInput, SelectInput, Button, LinePlot
from django.http import Http404  # JsonResponse
from math import pi
from math import log10
from json import loads


@login_required()
def home(request):
    """
    Controller for the app home page.
    """
    pipe_roughness = {
        'Riveted Steel': 0.0009, 'Concrete': 0.0003, 'Wood Stave': 0.00018,
        'Cast Iron': 0.00026, 'Galvanized Iron': 0.00015, 'Commercial Steel': 0.000045,
        'Drawn Turbing': 0.0000015, 'Plastic': 0, 'Glass': 0
    }

    k_value_options = [
        ('1.2 (Banana)', 1.2),
        ('1.05 (Cocoa)', 1.05),
        ('0.85 (Lemon)', 0.85),
        ('0.85 (Pineapple)', 0.85),
        ('1.15 (Beans)', 1.15),
        ('Other... (Specify)', 999)
    ]

    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    material_select_options = []
    for v, k in pipe_roughness.iteritems():
        material_select_options.append((v, float(k)))

    material_dropdown = SelectInput(display_text='Select Pipe Material',
                                    name='materialDropdown',
                                    multiple=False,
                                    options=material_select_options,
                                    initial=['Commercial Steel'],
                                    original=False)

    input_dam_height = TextInput(display_text='Dam Height',
                                 name='damHeight',
                                 append='Meters',
                                 initial=10)

    input_curve_number = TextInput(display_text='Curve Number',
                                   name='curveNumber',
                                   initial=80)

    input_household_water = TextInput(display_text='Average Daily Water Use Per Household',
                                      name='householdWater',
                                      append='Liters',
                                      initial=225)

    select_k_value = SelectInput(display_text='Crop K-Value',
                                 name='kValue1',
                                 multiple=False,
                                 original=False,
                                 options=k_value_options,
                                 attributes={
                                     'onclick': "$('.user-k-value').toggleClass('hidden', this.value != 999)"
                                 }
                                 )

    input_k_value = TextInput(display_text='Crop K Value',
                              name='kValue2')

    input_crop_name = TextInput(display_text='Crop Name',
                                name='cropName')

    text_input = TextInput(display_text='Water Temperature',
                           name='inputAmount',
                           placeholder='20.00',
                           append=unicode(u'\u00b0' + 'C'))

    input_tbv = TableView(column_names=('Input', 'Value', 'Units'),
                          rows=[('Length', 100, '[ M ]'),
                                ('Diameter', 1.5, '[ M ]'),
                                ('Elevation Head', 100, '[ M ]')],
                          hover=True,
                          striped=True,
                          bordered=True,
                          condensed=True,
                          editable_columns=(False, 'valueInput'),
                          row_ids=[0, 1, 2])

    bends_tbv = TableView(column_names=('Bends', 'Count'),
                          rows=[('90 Smooth (Flanged)', 0),
                                ('90 Smooth (Threaded)', 0),
                                ('90 Miter', 0),
                                ('45 Threaded Elbow', 1),
                                ('Threaded Union', 121)],
                          hover=True,
                          striped=True,
                          bordered=True,
                          condensed=True,
                          editable_columns=(False, 'BCountInput'),
                          row_ids=[0, 1, 2, 3, 4])

    inlets_tbv = TableView(column_names=('Inlets', 'Count'),
                           rows=[('Reentrant', 0),
                                 ('Sharp Edge', 1),
                                 ('Well-Rounded', 0),
                                 ('Slightly-Rounded', 0)],
                           hover=True,
                           striped=True,
                           bordered=True,
                           condensed=True,
                           editable_columns=(False, 'ICountInput'),
                           row_ids=[0, 1, 2, 3])

    exits_tbv = TableView(column_names=('Exit', 'Count'),
                          rows=[('Reentrant (Turb)', 0),
                                ('Sharp Edge (Turb)', 1),
                                ('Rounded (Turb)', 0)],
                          hover=True,
                          striped=True,
                          bordered=True,
                          condensed=True,
                          editable_columns=(False, 'ECountInput'),
                          row_ids=[0, 1, 2])

    grad_contraction_tbv = TableView(column_names=('Contraction', 'Count'),
                                     rows=[('30 Degree', 0),
                                           ('45 Degree', 0),
                                           ('60 Degree', 0)],
                                     hover=True,
                                     striped=True,
                                     bordered=True,
                                     condensed=True,
                                     editable_columns=(False, 'GCountInput'),
                                     row_ids=[0, 1, 2])

    context = {
        'materialDropdown': material_dropdown,
        'text_input': text_input,
        'input_tbv': input_tbv,
        'bends_tbv': bends_tbv,
        'inlets_tbv': inlets_tbv,
        'exits_tbv': exits_tbv,
        'gradContraction_tbv': grad_contraction_tbv,
        'input_dam_height': input_dam_height,
        'input_curve_number': input_curve_number,
        'select_k_value': select_k_value,
        'input_crop_name': input_crop_name,
        'input_k_value': input_k_value,
        'months': months,
        'input_household_water': input_household_water
    }

    return render(request, 'hydro_prospector_2/home.html', context)


def calculate_capacity(request):
    if request.POST:
        capacity_list = []

        params = request.POST

        pipe_material = float(params['materialDropdown'])
        length = float(params['valueInput0'])
        diameter = float(params['valueInput1'])
        elev_head = float(params['valueInput2'])
        flow_list = loads(params['flowList'])
        percentage_list = loads(params['percentList'])

        flow_list.reverse()
        percentage_list.reverse()

        density = 998
        kin_viscosity = 0.00000112
        turbine_efficiency = 0.53
        gravity = 9.81
        r_d_ratio = pipe_material / diameter
        x_s_area = pi * (diameter / 2.0) ** 2

        counter = 1
        for flow in flow_list:
            print 'Flow %s: %s' % (counter, flow)
            ave_velocity = flow / x_s_area
            reynolds_n = (ave_velocity * diameter) / kin_viscosity
            flow_type = 'Laminar' if reynolds_n < 2000 else 'Turbulent'
            # mass_f_r = density * flow
            friction_factor = 64 / reynolds_n if flow_type == 'Laminar' else (1 / (
                -1.8 * log10((r_d_ratio / 3.7) ** 1.11 + (6.9 / reynolds_n)))) ** 2

            smooth90_f = 0.3 * float(params['BCountInput0'])
            smooth90_t = 0.9 * float(params['BCountInput1'])
            miter90 = 1.1 * float(params['BCountInput2'])
            elbow45_t = 0.4 * float(params['BCountInput3'])
            union_t = 0.08 * float(params['BCountInput4'])

            reentrant = 0.8 * float(params['ICountInput0'])
            sharpe_edge = 0.5 * float(params['ICountInput1'])
            well_rounded = 0.03 * float(params['ICountInput2'])
            slightly_rounded = 0.12 * float(params['ICountInput3'])

            reentrant_t = 1.05 * float(params['ECountInput0'])
            sharpe_edge_t = 1.05 * float(params['ECountInput1'])
            rounded_t = 1.05 * float(params['ECountInput2'])

            degree30 = 0.02 * float(params['GCountInput0'])
            degree45 = 0.04 * float(params['GCountInput1'])
            degree60 = 0.07 * float(params['GCountInput2'])

            total_k = smooth90_f + smooth90_t + miter90 + elbow45_t + union_t + reentrant + sharpe_edge + \
                well_rounded + slightly_rounded + reentrant_t + sharpe_edge_t + rounded_t + degree30 + \
                degree45 + degree60

            minor_losses = total_k * (ave_velocity ** 2 / (2 * gravity))
            friction_loss = (friction_factor * length * ave_velocity ** 2) / (diameter * 2 * gravity)

            total_head_loss = minor_losses + friction_loss
            turbine_head = elev_head - total_head_loss

            print turbine_head, density, flow, turbine_efficiency, gravity
            capacity = (turbine_head * density * flow * turbine_efficiency * gravity) / 1000
            capacity_list.append((int(percentage_list[flow_list.index(flow)]),
                                  round(float(flow), 2),
                                  round(float(capacity), 2)))

        sorted_cap_list = sorted(capacity_list, key=lambda x: x[0])

        plot_data = []
        for i in sorted_cap_list:
            value = list(i)
            value.remove(value[0])
            plot_data.append(value)

        capacity_tbv = TableView(column_names=('Percent (%)', unicode('Flow (M' + u'\u00b2' + ' / S)'),
                                               'Capacity (kW)'),
                                 rows=sorted_cap_list,
                                 hover=True,
                                 striped=True,
                                 bordered=True,
                                 condensed=True,
                                 editable_columns=(False, False, False),
                                 row_ids=[range(0, len(sorted_cap_list))])

        line_plot_view = LinePlot(height='100%', width='100%', engine='highcharts',
                                  title='Flow capacity Curve', subtitle='User-selected location',
                                  spline=True, x_axis_title='Q', x_axis_units='M^2/S',
                                  y_axis_title='Capacity', y_axis_units='kW', series=[{'name': 'Capacity',
                                                                                       'color': '#277554',
                                                                                       'marker': {'enabled': False},
                                                                                       'data': plot_data
                                                                                       }]
                                  )

        context = {
            'capacity_tbv': capacity_tbv,
            'line_plot_view': line_plot_view
        }

        # return JsonResponse(context)

    else:
        raise Http404("No request was submitted.")

    return render(request, 'hydro_prospector_2/results.html', context)
