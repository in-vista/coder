using FrontEnd.Core.Interfaces;
using FrontEnd.Modules.Base.Models;
using Microsoft.AspNetCore.Mvc;

namespace FrontEnd.Modules.ImportExport.Controllers
{
    [Area("ImportExport"), Route("Modules/ImportExport")]
    public class ImportExportController(
        IBaseService baseService)
        : Controller
    {
        public IActionResult Index()
        {
            return View(baseService.CreateBaseViewModel<BaseModuleViewModel>());
        }
        
        [HttpGet, Route("Import")]
        public IActionResult Import()
        {
            return View(baseService.CreateBaseViewModel<BaseModuleViewModel>());
        }
        
        [HttpGet, Route("Import/Html")]
        public IActionResult ImportHtml()
        {
            return View();
        }
        
        [HttpGet, Route("Export")]
        public IActionResult Export()
        {
            return View(baseService.CreateBaseViewModel<BaseModuleViewModel>());
        }
        
        [HttpGet, Route("Export/Html")]
        public IActionResult ExportHtml()
        {
            return View();
        }
    }
}
