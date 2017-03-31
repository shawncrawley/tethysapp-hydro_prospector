from tethys_sdk.base import TethysAppBase, url_map_maker


class HydroProspector(TethysAppBase):
    """
    Tethys app class for Hydro Prospector.
    """

    name = 'Hydro Prospector'
    index = 'hydro_prospector_2:home'
    icon = 'hydro_prospector_2/images/icon.gif'
    package = 'hydro_prospector_2'
    root_url = 'hydro-prospector-2'
    color = '#1abc9c'
    description = 'Place a brief description of your app here.'
    enable_feedback = False
    feedback_emails = []

    def url_maps(self):
        """
        Add controllers
        """
        UrlMap = url_map_maker(self.root_url)

        url_maps = (UrlMap(name='home',
                           url='hydro-prospector-2',
                           controller='hydro_prospector_2.controllers.home'),
                    UrlMap(name='calculate_capacity',
                           url='hydro-prospector-2/calculate-capacity',
                           controller='hydro_prospector_2.controllers.calculate_capacity'),
                    )

        return url_maps